/**
 * Turnstile (PLAN §7.3 / §9.7). El API verifica el token en servidor y **nunca**
 * continúa si la verificación falla.
 *
 * Modos explícitos (`TURNSTILE_MODE`):
 * - `test`: claves de prueba oficiales; no se llama a la red y basta un token
 *   no vacío. Es el modo de local y de los tests.
 * - `enabled`: `siteverify` real; exige `TURNSTILE_SECRET_KEY` (si falta → 503).
 * - `disabled`: solo se acepta con `ENVIRONMENT=local`; en cualquier otro
 *   entorno es un fallo de configuración (503), nunca un bypass silencioso.
 */
export interface TurnstileEnv {
  ENVIRONMENT: string;
  TURNSTILE_MODE?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export type TurnstileFailure =
  | { kind: "config"; message: string }
  | { kind: "missing-token" }
  | { kind: "rejected" }
  | { kind: "unavailable"; message?: string };

export type TurnstileResult = { ok: true } | { ok: false; failure: TurnstileFailure };

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  env: TurnstileEnv,
  token: string | undefined,
  remoteIp: string,
): Promise<TurnstileResult> {
  const mode = env.TURNSTILE_MODE;

  if (mode === "disabled") {
    if (env.ENVIRONMENT !== "local") {
      return {
        ok: false,
        failure: {
          kind: "config",
          message: "TURNSTILE_MODE=disabled solo se permite en local.",
        },
      };
    }
    return { ok: true };
  }

  if (mode === "test") {
    return token?.trim() ? { ok: true } : { ok: false, failure: { kind: "missing-token" } };
  }

  if (mode !== "enabled") {
    return {
      ok: false,
      failure: { kind: "config", message: "TURNSTILE_MODE ausente o desconocido." },
    };
  }

  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return {
      ok: false,
      failure: { kind: "config", message: "Falta TURNSTILE_SECRET_KEY." },
    };
  }
  if (!token?.trim()) {
    return { ok: false, failure: { kind: "missing-token" } };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    return {
      ok: false,
      failure: {
        kind: "unavailable",
        ...(error instanceof Error ? { message: error.message } : {}),
      },
    };
  }

  if (!response.ok) {
    return { ok: false, failure: { kind: "unavailable" } };
  }

  const result = (await response.json()) as { success?: boolean };
  return result.success === true ? { ok: true } : { ok: false, failure: { kind: "rejected" } };
}
