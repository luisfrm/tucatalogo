/**
 * Piezas comunes de las dos instancias de Better Auth (PLAN §7.1 / §7.2).
 *
 * El API **no** monta el handler HTTP de Better Auth: todas las llamadas son
 * de servidor (`auth.api.*`) desde nuestros routes, que ya aplican Turnstile,
 * rate limits, resolución de tienda por cabecera interna y el envelope de
 * error propio. Así el `Set-Cookie` que sale del API es exactamente el de
 * Better Auth, sin `domain`, y nunca se devuelve un token en el body.
 */
import type { Context } from "hono";

import { AUTH_MESSAGES, INTERNAL_AUTH_ORIGIN } from "../constants/auth";
import type { Env } from "../env";
import { AppError } from "../errors";

export type AuthRealm = "store" | "console";

/** Secreto por reino. Falta de secreto = 503 + log, nunca un valor por defecto. */
export function requireAuthSecret(env: Env, realm: AuthRealm): string {
  const secret = realm === "store" ? env.BETTER_AUTH_SECRET_STORE : env.BETTER_AUTH_SECRET_CONSOLE;
  if (!secret || secret.length < 16) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Falta el secreto de Better Auth del reino",
        realm,
        variable: realm === "store" ? "BETTER_AUTH_SECRET_STORE" : "BETTER_AUTH_SECRET_CONSOLE",
      }),
    );
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  return secret;
}

export function isLocalEnv(env: Env): boolean {
  return env.ENVIRONMENT === "local";
}

/**
 * Cabeceras que se reenvían a Better Auth:
 * - `cookie`: la del navegador, tal cual (host-only, prefijo del reino).
 * - `origin`: **siempre** el origen interno. Nunca el `Origin` del cliente, que
 *   además no es fiable porque la petición llega por service binding.
 * - `x-forwarded-for`: IP del cliente para `session.ip_address` y sus límites.
 *
 * Cualquier otra cabecera del cliente se descarta (no arrastramos `referer`,
 * `sec-fetch-*` ni cabeceras de proxy a la capa de auth).
 */
export function toAuthHeaders(request: Request, clientIp?: string): Headers {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set("origin", INTERNAL_AUTH_ORIGIN);
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  return headers;
}

/** Error devuelto por un endpoint de Better Auth. */
export class AuthEndpointError extends Error {
  constructor(
    readonly status: number,
    readonly authCode: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthEndpointError";
  }
}

/** Usuario mínimo que el API devuelve al frontend (nunca el token). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
}

/**
 * Extrae `{ id, email, name, twoFactorEnabled }` de la respuesta de
 * `getSession`/`signInEmail` sin confiar en los tipos de la librería (que
 * cambian entre versiones). `null` si el shape no es el esperado.
 */
export function asSessionUser(payload: unknown): SessionUser | null {
  if (!payload || typeof payload !== "object") return null;
  const user = (payload as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const record = user as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.email !== "string") return null;
  return {
    id: record.id,
    email: record.email,
    name: typeof record.name === "string" ? record.name : "",
    twoFactorEnabled: record.twoFactorEnabled === true,
  };
}

/** Lee `expiresAt` de la sesión de Better Auth como ISO-8601. */
export function asSessionExpiry(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const session = (payload as { session?: unknown }).session;
    if (session && typeof session === "object") {
      const expiresAt = (session as { expiresAt?: unknown }).expiresAt;
      if (expiresAt instanceof Date) return expiresAt.toISOString();
      if (typeof expiresAt === "string") {
        const parsed = new Date(expiresAt);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

/** Cookie header a partir de los `Set-Cookie` de una respuesta interna. */
export function cookiesToHeader(setCookies: readonly string[]): string {
  const pairs: string[] = [];
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0]?.trim();
    if (pair && pair.includes("=")) pairs.push(pair);
  }
  return pairs.join("; ");
}

export interface AuthCallResult<T> {
  data: T | null;
  setCookies: string[];
}

function extractAuthCode(payload: unknown): { code: string; message: string } {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "UNKNOWN";
    const message = typeof record.message === "string" ? record.message : "Error de autenticación";
    return { code, message };
  }
  return { code: "UNKNOWN", message: "Error de autenticación" };
}

/**
 * Ejecuta un endpoint de Better Auth con `asResponse: true`, separa las
 * cookies del cuerpo y convierte el fallo en `AuthEndpointError`.
 */
export async function callAuthEndpoint<T>(promise: Promise<Response>): Promise<AuthCallResult<T>> {
  const response = await promise;
  const setCookies = response.headers.getSetCookie();
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const { code, message } = extractAuthCode(payload);
    throw new AuthEndpointError(response.status, code, message);
  }

  return { data: (payload as T) ?? null, setCookies };
}

/**
 * Traduce un fallo de Better Auth al envelope del proyecto. El mensaje que ve
 * el usuario lo decide el service (nunca el texto interno de la librería), y
 * `reason` conserva el código de Better Auth para diagnóstico accionable.
 */
export function toAppError(error: AuthEndpointError, fallbackMessage: string, fallbackReason?: string): AppError {
  if (error.status === 429) {
    return new AppError("RATE_LIMITED", AUTH_MESSAGES.rateLimited, undefined, fallbackReason);
  }
  if (error.status === 403) {
    return new AppError("FORBIDDEN", fallbackMessage, undefined, fallbackReason ?? error.authCode);
  }
  if (error.status === 401) {
    return new AppError("UNAUTHORIZED", fallbackMessage, undefined, fallbackReason ?? error.authCode);
  }
  if (error.status >= 500) {
    return new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  return new AppError("VALIDATION_ERROR", fallbackMessage, undefined, fallbackReason ?? error.authCode);
}

/** Añade los `Set-Cookie` del API a la respuesta (uno por cookie). */
export function applySetCookies(c: Context, setCookies: readonly string[]): void {
  for (const cookie of setCookies) {
    c.header("set-cookie", cookie, { append: true });
  }
}
/**
 * Logger de Better Auth con redacción: nunca escribe emails, tokens ni
 * payloads; solo nivel y un mensaje acotado con patrones sensibles borrados.
 */
export function createAuthLogger(realm: AuthRealm) {
  return {
    disabled: false,
    level: "error" as const,
    log: (level: string, message: string, ...args: unknown[]) => {
      if (level !== "error" && level !== "warn") return;
      const redacted = message
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
        .slice(0, 300);
      console.log(
        JSON.stringify({
          level: level === "warn" ? "warn" : "error",
          source: "better-auth",
          realm,
          message: redacted,
          // Solo el número de argumentos: nunca su contenido.
          args: args.length,
        }),
      );
    },
  };
}
