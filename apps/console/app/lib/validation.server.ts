import { consoleSuspendStoreSchema, passwordSchema } from "@tucatalogo/types";

/**
 * Validación de formularios del console (PLAN §11.3).
 *
 * Usa los mismos schemas Zod que el API y solo se importa desde loaders/actions
 * (módulo `.server`), para no enviar Zod al navegador. El API vuelve a validar
 * todo: esto solo da mensajes inmediatos y evita viajes inútiles.
 */

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Motivo de suspensión: mismo schema que el API (3–300 caracteres). */
export function validateSuspendReason(
  raw: FormDataEntryValue | null | undefined,
): ValidationResult<string> {
  const parsed = consoleSuspendStoreSchema.safeParse({
    reason: typeof raw === "string" ? raw : "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Escribe el motivo de la suspensión.",
    };
  }
  return { ok: true, value: parsed.data.reason };
}

/**
 * Confirmación de borrado: el valor debe coincidir con el slug exacto
 * (sin distinguir mayúsculas, igual que la comprobación del API). El API vuelve
 * a verificar contra D1; aquí solo evitamos un viaje con un error evidente.
 */
export function validateSlugConfirmation(
  raw: FormDataEntryValue | null | undefined,
  expectedSlug: string,
): ValidationResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: "Escribe el identificador de la tienda." };
  }
  if (value.toLowerCase() !== expectedSlug.toLowerCase()) {
    return { ok: false, message: "El identificador no coincide con el de la tienda." };
  }
  return { ok: true, value };
}

/** Contraseña + confirmación para `/init` y `/restablecer`. */
export function validatePasswordPair(
  passwordRaw: FormDataEntryValue | null | undefined,
  confirmationRaw: FormDataEntryValue | null | undefined,
): ValidationResult<string> {
  const parsed = passwordSchema.safeParse(typeof passwordRaw === "string" ? passwordRaw : "");
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Revisa la contraseña.",
    };
  }
  const confirmation = typeof confirmationRaw === "string" ? confirmationRaw : "";
  if (parsed.data !== confirmation) {
    return { ok: false, message: "Las contraseñas no coinciden." };
  }
  return { ok: true, value: parsed.data };
}
