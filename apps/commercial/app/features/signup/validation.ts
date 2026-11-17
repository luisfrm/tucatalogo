import { CURRENCIES, emailSchema, passwordSchema, storeSlugSchema } from "@tucatalogo/types";

import type { FieldErrors, OwnerDraft, SlugStatus } from "./types";

/**
 * Validación de cada paso. Funciones puras y compartidas por el cliente (para
 * dar feedback inmediato) y el servidor (el `action` revalida antes de llamar
 * al API). El API vuelve a validar: aquí no se decide nada de negocio.
 */

export const OWNER_FIELD_ORDER = [
  "name",
  "email",
  "password",
  "passwordConfirm",
  "storeName",
  "slug",
  "currency",
  "terms",
] as const;

export const THEME_FIELD_ORDER = ["theme"] as const;

export const OTP_FIELD_ORDER = ["turnstileToken", "code"] as const;

const SLUG_FORMAT_MESSAGE =
  "Solo minúsculas, números y guiones; entre 2 y 63 caracteres, sin guion al final.";

function issueMessage(result: { success: false; error: { issues: { message: string }[] } }): string {
  return result.error.issues[0]?.message ?? "Revisa este campo.";
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Primer campo con error, en el orden visual del formulario. */
export function firstErrorField(
  errors: FieldErrors,
  order: readonly string[],
): string | null {
  for (const field of order) {
    if (errors[field]) return field;
  }
  return Object.keys(errors)[0] ?? null;
}

/** Paso 1: cuenta del dueño, datos de la tienda y aceptación de legales. */
export function validateOwnerDraft(
  draft: OwnerDraft,
  slugStatus: SlugStatus,
): FieldErrors {
  const errors: FieldErrors = {};

  if (draft.name.trim().length < 2) {
    errors.name = "Escribe tu nombre (2 caracteres o más).";
  }

  const email = emailSchema.safeParse(draft.email);
  if (!email.success) {
    errors.email = issueMessage(email);
  }

  const password = passwordSchema.safeParse(draft.password);
  if (!password.success) {
    errors.password = issueMessage(password);
  }

  if (draft.passwordConfirm.length === 0) {
    errors.passwordConfirm = "Repite la contraseña.";
  } else if (draft.password !== draft.passwordConfirm) {
    errors.passwordConfirm = "Las contraseñas no coinciden.";
  }

  if (draft.storeName.trim().length < 2) {
    errors.storeName = "Escribe el nombre de tu tienda.";
  }

  const slug = storeSlugSchema.safeParse(draft.slug);
  if (!slug.success) {
    errors.slug = SLUG_FORMAT_MESSAGE;
  } else if (slugStatus.kind === "available" && slugStatus.slug === draft.slug) {
    // Disponible y comprobado para este mismo valor.
  } else if (slugStatus.kind === "unavailable" && slugStatus.slug === draft.slug) {
    errors.slug = slugStatus.message;
  } else {
    errors.slug = "Comprueba que el identificador esté disponible.";
  }

  if (!draft.currency) {
    errors.currency = "Elige la moneda con la que venderás.";
  } else if (!CURRENCIES.includes(draft.currency)) {
    errors.currency = "Elige una moneda de la lista.";
  }

  if (!draft.acceptedTerms) {
    errors.terms = "Debes aceptar los términos y el aviso de privacidad.";
  }

  return errors;
}

/** Paso 2: un tema implementado, de la lista que expone `packages/themes`. */
export function validateThemeStep(
  themeId: string | null,
  availableThemeIds: readonly string[],
): FieldErrors {
  if (!themeId || !availableThemeIds.includes(themeId)) {
    return { theme: "Elige un tema para continuar." };
  }
  return {};
}

/** Paso 3 · solicitar código: el token de Turnstile es obligatorio. */
export function validateOtpRequest(turnstileToken: string | null): FieldErrors {
  if (!turnstileToken) {
    return {
      turnstileToken: "Completa la verificación anti-bot para recibir el código.",
    };
  }
  return {};
}

/** Paso 3 · verificar: código de 6 dígitos. */
export function validateOtpCode(code: string): FieldErrors {
  if (!/^\d{6}$/.test(code.trim())) {
    return { code: "El código tiene 6 dígitos." };
  }
  return {};
}
