import { STORE_SLUG_REGEX } from "@tucatalogo/types";

import { isReservedSlug } from "../constants/reserved-slugs";

export type SlugRejectionReason = "empty" | "format" | "reserved";

/** Normaliza la entrada del usuario sin decidir por él: solo trim + minúsculas. */
export function normalizeSlugInput(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidSlugFormat(slug: string): boolean {
  return STORE_SLUG_REGEX.test(slug);
}

/**
 * Devuelve el motivo del rechazo o `null` si el formato es aceptable.
 * La disponibilidad (ocupado/cuarentena) la decide el API contra D1.
 */
export function getSlugRejectionReason(slug: string): SlugRejectionReason | null {
  if (slug.length === 0) {
    return "empty";
  }
  if (!isValidSlugFormat(slug)) {
    return "format";
  }
  if (isReservedSlug(slug)) {
    return "reserved";
  }
  return null;
}
