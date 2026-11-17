import { CURRENCIES, type Currency } from "@tucatalogo/types";

import type { FieldErrors } from "./types";

/**
 * Mensajes en español del registro.
 *
 * El API ya devuelve mensajes aptos para usuario final, pero el registro
 * necesita además: (a) asignar el error al campo correcto y (b) traducir los
 * `reason` estables (`AUTH_REASONS` del API) a una acción concreta.
 */

/** Enfriamiento documentado del OTP (PLAN §7.3). No es un default del API. */
export const OTP_COOLDOWN_SECONDS = 60;

const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "Dólar estadounidense (USD)",
  EUR: "Euro (EUR)",
  COP: "Peso colombiano (COP)",
  VES: "Bolívar (VES)",
  ARS: "Peso argentino (ARS)",
};

export interface CurrencyOption {
  value: Currency;
  label: string;
}

/** Opciones del selector, en el orden de `CURRENCIES` (sin moneda por defecto). */
export const CURRENCY_OPTIONS: readonly CurrencyOption[] = CURRENCIES.map((currency) => ({
  value: currency,
  label: CURRENCY_LABELS[currency],
}));

export function currencyLabel(currency: Currency): string {
  return CURRENCY_LABELS[currency];
}

/** Mensajes de la comprobación en vivo del slug (motivos del API). */
const SLUG_REASON_MESSAGES = {
  empty: "Escribe el identificador de tu tienda.",
  format: "Solo minúsculas, números y guiones; entre 2 y 63 caracteres, sin guion al final.",
  reserved: "Ese identificador está reservado. Prueba con otro.",
  taken: "Ese identificador ya está en uso. Prueba con otro.",
  quarantined: "Ese identificador no estará libre hasta dentro de un tiempo. Prueba con otro.",
} as const;

export type SlugReason = keyof typeof SLUG_REASON_MESSAGES;

export function slugReasonMessage(reason: SlugReason): string {
  return SLUG_REASON_MESSAGES[reason];
}

/** Sub-códigos estables del API (`AUTH_REASONS`) con su acción en el registro. */
const REASON_MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "Ese identificador acaba de ocuparse. Prueba con otro.",
  SLUG_RESERVED: "Ese identificador está reservado. Prueba con otro.",
  SLUG_QUARANTINED:
    "Ese identificador no estará libre hasta dentro de un tiempo (90 días tras borrar una tienda). Prueba con otro.",
  SLUG_FORMAT: "El identificador solo admite minúsculas, números y guiones.",
  STORE_SLUG_INVALID: "El identificador no es válido. Revisa el formato.",
  EMAIL_TAKEN: "Ese email ya tiene una cuenta. Inicia sesión en tu panel o usa otro email.",
  OTP_INVALID: "El código no es correcto. Revisa los 6 dígitos.",
  OTP_EXPIRED: "El código caducó. Pide uno nuevo.",
  OTP_ATTEMPTS_EXHAUSTED: "Agotaste los intentos de este código. Pide uno nuevo.",
  OTP_COOLDOWN: "Espera unos segundos antes de pedir otro código.",
  TURNSTILE_FAILED: "No pudimos verificar que no eres un robot. Vuelve a intentarlo.",
  THEME_UNAVAILABLE: "Ese tema no está disponible. Elige otro.",
  CONFIG_MISSING: "El registro no está disponible ahora mismo. Inténtalo más tarde.",
};

/** Campo del formulario al que pertenece cada sub-código. */
const REASON_FIELDS: Record<string, string> = {
  SLUG_TAKEN: "slug",
  SLUG_RESERVED: "slug",
  SLUG_QUARANTINED: "slug",
  SLUG_FORMAT: "slug",
  STORE_SLUG_INVALID: "slug",
  EMAIL_TAKEN: "email",
  OTP_INVALID: "code",
  OTP_EXPIRED: "code",
  OTP_ATTEMPTS_EXHAUSTED: "code",
  TURNSTILE_FAILED: "turnstileToken",
  THEME_UNAVAILABLE: "theme",
};

/** Forma mínima de `ApiClientError` (sin acoplar el navegador al paquete). */
export interface ApiErrorLike {
  status: number;
  code: string;
  message: string;
  reason?: string;
  details?: { path: string; message: string }[];
  requestId?: string;
}

export interface ApiErrorDescription {
  message: string;
  /** Errores por campo listos para pintar junto al input. */
  errors: FieldErrors;
  reason?: string;
  /** Segundos de espera sugeridos para `OTP_COOLDOWN` / `RATE_LIMITED`. */
  retryAfterSeconds?: number;
}

const GENERIC_API_ERROR = "No pudimos completar la solicitud. Inténtalo de nuevo.";

/** El API nombra los campos como su contrato; el formulario usa sus ids. */
const DETAIL_FIELD_ALIASES: Record<string, string> = { themeId: "theme" };

/**
 * `ApiClientError` sin importar el paquete en el navegador: basta con la forma
 * del error que serializa `packages/api-client`.
 */
export function isApiErrorLike(error: unknown): error is ApiErrorLike {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  return (
    typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

export function describeApiError(error: ApiErrorLike): ApiErrorDescription {
  const errors: FieldErrors = {};
  let retryAfterSeconds: number | undefined;

  if (error.details?.length) {
    for (const detail of error.details) {
      const field = DETAIL_FIELD_ALIASES[detail.path] ?? detail.path;
      errors[field] = detail.message;
    }
  }

  let message = error.reason ? REASON_MESSAGES[error.reason] : undefined;

  if (!message) {
    if (error.code === "RATE_LIMITED") {
      message = "Hiciste demasiadas solicitudes. Espera un minuto y vuelve a intentarlo.";
    } else if (error.code === "SERVICE_UNAVAILABLE") {
      message = "El registro no está disponible ahora mismo. Inténtalo más tarde.";
    } else if (error.status >= 500) {
      message = GENERIC_API_ERROR;
    } else {
      message = error.message.trim() || GENERIC_API_ERROR;
    }
  }

  if (error.reason === "OTP_COOLDOWN" || error.code === "RATE_LIMITED") {
    retryAfterSeconds = OTP_COOLDOWN_SECONDS;
  }

  const field = error.reason ? REASON_FIELDS[error.reason] : undefined;
  if (field && !errors[field]) {
    errors[field] = message;
  }

  return {
    message,
    errors,
    ...(error.reason ? { reason: error.reason } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}
