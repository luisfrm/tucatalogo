/**
 * Traducción de errores del API a mensajes de UI (PLAN §8.3 / §12).
 *
 * El API siempre responde con `{ error: { code, message, reason, details } }`.
 * `ApiClientError` lo convierte en un `Error` con `status`, `code`, `message`,
 * `reason` y `details`. Estas funciones aceptan `unknown` y trabajan sobre esa
 * forma estructural, así que no atan la UI a una clase concreta ni ocultan
 * errores desconocidos: sin forma reconocible se muestra el mensaje genérico.
 */

export interface ApiErrorShape {
  status: number;
  code?: string;
  message: string;
  reason?: string;
  details?: { path: string; message: string }[];
  /**
   * Segundos de `Retry-After`. `ApiClientError` no expone cabeceras hoy; si en
   * el futuro las añade, la UI lo aprovecha sin cambiar de contrato.
   */
  retryAfterSeconds?: number;
}

export function toApiErrorShape(error: unknown): ApiErrorShape | null {
  if (!error || typeof error !== "object") return null;

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    reason?: unknown;
    details?: unknown;
    retryAfterSeconds?: unknown;
  };

  if (typeof candidate.status !== "number") return null;
  if (typeof candidate.message !== "string" || candidate.message.trim() === "") return null;

  return {
    status: candidate.status,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: candidate.message,
    reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
    details: Array.isArray(candidate.details)
      ? (candidate.details as { path: string; message: string }[])
      : undefined,
    retryAfterSeconds:
      typeof candidate.retryAfterSeconds === "number" ? candidate.retryAfterSeconds : undefined,
  };
}

export function isRateLimited(error: unknown): boolean {
  return toApiErrorShape(error)?.status === 429;
}

/** Mensaje para el usuario; los 429 incluyen la espera cuando está disponible. */
export function describeApiError(
  error: unknown,
  fallback = "No pudimos completar la solicitud. Inténtalo de nuevo.",
): string {
  const shape = toApiErrorShape(error);
  if (!shape) return fallback;

  if (shape.status === 429) {
    return shape.retryAfterSeconds
      ? `${shape.message} Vuelve a intentarlo en ${shape.retryAfterSeconds} s.`
      : shape.message;
  }

  return shape.message;
}

/** Errores por campo (`details`) para pintarlos junto al input. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  const shape = toApiErrorShape(error);
  const errors: Record<string, string> = {};
  for (const detail of shape?.details ?? []) {
    if (detail.path && !errors[detail.path]) errors[detail.path] = detail.message;
  }
  return errors;
}

export function statusFromApiError(error: unknown): number {
  const status = toApiErrorShape(error)?.status ?? 500;
  return status >= 400 && status < 600 ? status : 500;
}
