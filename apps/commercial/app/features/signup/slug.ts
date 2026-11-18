const SLUG_MAX_LENGTH = 63;
const SLUG_FALLBACK_LABEL = "tu-tienda";

/**
 * Normaliza lo que escribe la persona sin decidir por ella: acentos fuera,
 * minúsculas, separadores a guion y sin guiones en los extremos. El formato
 * final lo vuelve a validar Zod (`storeSlugSchema`) y el API.
 */
export function toSlugDraft(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

/** `mi-tienda` + `tucatalogo.live` → `mi-tienda.tucatalogo.live`. */
export function slugDomain(slug: string, domain: string): string {
  const clean = slug.trim().replace(/^-+|-+$/g, "");
  return `${clean.length > 0 ? clean : SLUG_FALLBACK_LABEL}.${domain}`;
}

/** Ruta del panel de la tienda dentro del storefront. */
export function panelLoginPath(panelUrl: string): string {
  return `${panelUrl.replace(/\/+$/, "")}/login`;
}
