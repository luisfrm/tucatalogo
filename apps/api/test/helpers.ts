/**
 * Helpers de los tests de auth. Todo corre en el runtime de Workers con D1
 * local: sin red, sin servicios externos.
 */
import { env, SELF } from "cloudflare:test";

export const API_ORIGIN = "http://api.internal";

/**
 * Aplica variables de entorno temporales para probar el no-fallback y los
 * guards por entorno. Restaura los valores originales siempre.
 */
export async function withEnv<T>(
  overrides: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, unknown>();
  const target = env as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, target[key]);
    target[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      target[key] = value;
    }
  }
}

/** Fetch al worker `api` (mismo isolate que el test). */
export function api(path: string, init?: RequestInit): Promise<Response> {
  return SELF.fetch(`${API_ORIGIN}${path}`, init);
}

export function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return api(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Los contadores de rate limit viven en D1 y no se reinician entre casos:
      // cada petición de test simula un cliente distinto salvo que fije su IP.
      "x-client-ip": nextTestIp(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export function getJson(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return api(path, { headers });
}

/** Todos los `Set-Cookie` de una respuesta (cada cookie por separado). */
export function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

/** `name=value` de la cookie pedida, listo para reenviar en `Cookie`. */
export function cookiePair(response: Response, name: string): string {
  for (const cookie of setCookies(response)) {
    const pair = cookie.split(";")[0]?.trim();
    if (pair?.startsWith(`${name}=`)) return pair;
  }
  throw new Error(`La respuesta no trae la cookie ${name}. Cookies: ${setCookies(response).join(" | ")}`);
}

export function hasCookie(response: Response, name: string): boolean {
  return setCookies(response).some((cookie) => cookie.startsWith(`${name}=`));
}

/**
 * ¿La respuesta fija una cookie **válida** con ese nombre? Better Auth emite
 * cookies de borrado (`Max-Age=0`) al pasar a un challenge de 2FA; esas no
 * cuentan como sesión.
 */
export function hasLiveCookie(response: Response, name: string): boolean {
  return setCookies(response).some((cookie) => {
    if (!cookie.startsWith(`${name}=`)) return false;
    if (/max-age=0\b/i.test(cookie)) return false;
    const expires = cookie.match(/expires=([^;]+)/i);
    if (expires?.[1] && new Date(expires[1]).getTime() <= Date.now()) return false;
    return true;
  });
}

let counter = 0;

/**
 * IP única por petición de test: los contadores de rate limit viven en D1 y
 * persisten entre casos, así que cada petición "normal" usa su propia IP.
 */
let ipCounter = 0;

export function nextTestIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 62500) % 250}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

export function uniqueEmail(prefix = "dueno"): string {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}.${counter}@example.com`;
}

export function uniqueSlug(prefix = "tienda"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`.slice(0, 40);
}

export interface ApiErrorBody {
  error: { code: string; message: string; reason?: string; requestId: string };
}

/** Extrae el OTP de 6 dígitos del correo enviado por el driver `memory`. */
export function extractOtp(text: string): string {
  const match = text.match(/\b\d{6}\b/);
  if (!match?.[0]) throw new Error(`El correo no contiene un OTP: ${text}`);
  return match[0];
}

/** Extrae el enlace de reset del correo. */
export function extractResetToken(text: string): string {
  const match = text.match(/[?&]token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`El correo no contiene un token de reset: ${text}`);
  return match[1];
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/**
 * TOTP (RFC 6238, HMAC-SHA1) para generar el código del test.
 * Better Auth usa 6 dígitos y periodo de 30 s.
 */
export async function totp(secretBase32: string, at: number = Date.now()): Promise<string> {
  const counter = Math.floor(at / 1000 / 30);
  const counterBytes = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i -= 1) {
    counterBytes[i] = value & 0xff;
    value = Math.floor(value / 256);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secretBase32),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = signature[signature.length - 1]! & 0x0f;
  const binary =
    ((signature[offset]! & 0x7f) << 24) |
    ((signature[offset + 1]! & 0xff) << 16) |
    ((signature[offset + 2]! & 0xff) << 8) |
    (signature[offset + 3]! & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

/** `secret` del `otpauth://` que devuelve `enableTwoFactor`. */
export function totpSecretFromUri(uri: string): string {
  const match = uri.match(/[?&]secret=([A-Za-z2-7]+)/);
  if (!match?.[1]) throw new Error(`URI TOTP sin secret: ${uri}`);
  return match[1];
}
