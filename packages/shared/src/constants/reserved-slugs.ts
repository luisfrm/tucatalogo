/**
 * Slugs que nunca pueden ser tienda (PLAN §6.10 / AGENTS §18).
 * Lista canónica: si cambia, cambia en un solo sitio.
 */
export const RESERVED_SLUGS = [
  "www",
  "api",
  "panel",
  "admin",
  "console",
  "bucket",
  "app",
  "mail",
  "static",
  "media",
  "assets",
  "cdn",
  "commercial",
  "tucatalogo",
  // Legado del dominio anterior (`*.tucatalogo.luisrivas.site`): se mantienen
  // reservados para que nadie registre el slug de un host que existió.
  "console-tucatalogo",
  "tucatalogo-bucket",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

const RESERVED_SLUG_SET: ReadonlySet<string> = new Set(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug);
}
