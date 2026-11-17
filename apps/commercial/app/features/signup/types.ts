import type { Currency, SignupResponse } from "@tucatalogo/types";

/** Paso visible del registro (el paso 4 ya es confirmación). */
export type SignupStep = 1 | 2 | 3 | 4;

/** Errores por campo; las claves coinciden con los `id` de los inputs. */
export type FieldErrors = Record<string, string>;

export interface OwnerDraft {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  storeName: string;
  slug: string;
  /** Vacío hasta que la persona elija: no hay moneda por defecto. */
  currency: Currency | "";
  acceptedTerms: boolean;
}

/**
 * Estado inicial del formulario. Vive **solo en memoria** de React: ni la
 * contraseña ni el resto del paso 1 se guardan en `localStorage`/`sessionStorage`
 * (PLAN §4.5 A). Recargar la página vuelve al paso 1.
 */
export const EMPTY_OWNER_DRAFT: OwnerDraft = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  storeName: "",
  slug: "",
  currency: "",
  acceptedTerms: false,
};

/** Resultado de la comprobación en vivo del slug (`/registro/slug-check`). */
export type SlugStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; slug: string; storefront: string; panel: string }
  | { kind: "unavailable"; slug: string; message: string };

/** Fase del paso 3 (OTP). */
export type OtpPhase = "idle" | "sending" | "sent" | "verifying" | "expired" | "exhausted";

export interface SignupActionFailure {
  ok: false;
  intent: "otp" | "signup";
  message: string;
  errors: FieldErrors;
  reason?: string;
  retryAfterSeconds?: number;
}

export interface OtpActionSuccess {
  ok: true;
  intent: "otp";
  resendAfterSeconds: number;
  expiresInMinutes: number;
}

export interface SignupActionSuccess {
  ok: true;
  intent: "signup";
  result: SignupResponse;
}

/** Contrato único del `action` de `/registro` (se discrimina por `intent`). */
export type SignupActionData =
  | OtpActionSuccess
  | SignupActionSuccess
  | SignupActionFailure;
