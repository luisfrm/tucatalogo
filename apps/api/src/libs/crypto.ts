/**
 * Utilidades criptográficas de auth: OTP, hashes y comparación en tiempo
 * constante. Nunca se guarda ni se registra un código o una IP en claro.
 */
import { SIGNUP_OTP } from "../constants/auth";

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/** Importa una clave HMAC-SHA256 (la usan OTP e IP hashing). */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToHex(new Uint8Array(signature));
}

/** SHA-256 hexadecimal de un texto (identificadores deterministas). */
export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return bytesToHex(new Uint8Array(digest));
}

/** Código de 6 dígitos sin sesgo de módulo. */
export function generateOtp(length: number = SIGNUP_OTP.length): string {
  let code = "";
  while (code.length < length) {
    const buffer = new Uint8Array(length * 2);
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      // Rechaza 250..255 para que el resto sea uniforme.
      if (byte >= 250) continue;
      code += (byte % 10).toString();
      if (code.length === length) break;
    }
  }
  return code;
}

/**
 * Hash del OTP: HMAC-SHA256 con el secreto del reino sobre `intentId:code`.
 * El intent id ata el hash a la fila: copiar el hash a otra fila no sirve.
 */
export function hashOtp(secret: string, intentId: string, code: string): Promise<string> {
  return hmacHex(secret, `otp:${intentId}:${code}`);
}

/** Comparación en tiempo constante de dos cadenas hexadecimales. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** Código hexadecimal aleatorio (tokens de un solo uso: OTP de enrolamiento). */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let out = "";
  for (const byte of buffer) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** Hash estable de una IP (nunca se guarda la IP en claro). */
export function hashIp(secret: string, ip: string): Promise<string> {
  return hmacHex(secret, `ip:${ip}`);
}

/** Hash estable de un email normalizado, para buckets de rate limit y logs. */
export function hashEmail(secret: string, email: string): Promise<string> {
  return hmacHex(secret, `email:${email.trim().toLowerCase()}`);
}
