import { ApiClientError, readConsoleSession, type ApiClient, type ApiContext } from "@tucatalogo/api-client";
import { redirect } from "react-router";

/**
 * Guard de sesión del console (PLAN §7.2 / §11.3).
 *
 * Toda ruta protegida valida en el **loader/action**, nunca en el cliente:
 * - sin sesión (401) → `/login`.
 * - sesión sin 2FA completado (403 `TWO_FACTOR_REQUIRED`) → `/2fa`.
 *
 * Cualquier otro fallo se propaga (no se convierte en "sin sesión": sería un
 * fallback silencioso).
 */
export async function requireConsoleSession(api: ApiClient, context: ApiContext) {
  try {
    return await readConsoleSession(api, context);
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) throw redirect("/login");
      if (error.status === 403 && error.reason === "TWO_FACTOR_REQUIRED") {
        throw redirect("/2fa");
      }
    }
    throw error;
  }
}

/** `true` si el error es un 401 del API (sesión ausente o caducada). */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

/** `true` si el error pide completar el segundo factor. */
export function isTwoFactorRequired(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status === 403 &&
    error.reason === "TWO_FACTOR_REQUIRED"
  );
}

/** Traduce 401/403 de una llamada ya autenticada a su redirect correspondiente. */
export function rethrowAuthRedirect(error: unknown): void {
  if (isUnauthorized(error)) throw redirect("/login");
  if (isTwoFactorRequired(error)) throw redirect("/2fa");
}
