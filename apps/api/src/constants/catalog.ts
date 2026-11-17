/**
 * Constantes del catálogo, del panel y del console (PLAN §6, §8.2, §8.5).
 *
 * Un solo sitio para los topes del contrato: si cambia un número, cambia aquí
 * y en `PLAN.md`. Los tests verdes son la prueba de que ambos coinciden.
 */

/** Paginación fija por superficie (el cliente solo elige la página). */
export const PAGE_SIZE = {
  public: 24,
  panel: 20,
  console: 20,
  audit: 20,
} as const;

/** Topes de imágenes (PLAN §6 / §8.5). */
export const MEDIA_LIMITS = {
  /** Tope de entrada por objeto, ya normalizado en el navegador. */
  maxBytes: 2 * 1024 * 1024,
  /** Ancho máximo del full de producto y del logo. */
  fullMaxWidth: 1600,
  /** Ancho máximo del thumb de producto. */
  thumbMaxWidth: 600,
  /** Ancho máximo de cada variante del hero. */
  heroMaxWidth: 1600,
  /** Imágenes por producto. */
  productImages: 8,
  /** Slides de hero por tienda. */
  heroSlides: 10,
} as const;

/** Un solo MIME admitido: WebP real (magic bytes, no `Content-Type`). */
export const MEDIA_CONTENT_TYPE = "image/webp";

/** Keys inmutables: caché de un año (PLAN §8.5). */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Prefijo R2 de una tienda. Todo lo que cuelga de aquí se borra en el hard delete. */
export function storeMediaPrefix(storeId: string): string {
  return `stores/${storeId}/`;
}

/** Prefijo público que sirve `/media/*` en local/dev. */
export const DEV_MEDIA_PREFIX = "stores/";

/** Días de cuarentena de un slug tras el hard delete (PLAN §6.10). */
export const SLUG_QUARANTINE_DAYS = 90;

/**
 * Rate limits de operaciones de negocio (PLAN §7.7 / §8.8).
 *
 * Viven aquí, no en `constants/auth.ts`, porque el sujeto (id de tienda) y la
 * operación son del catálogo. Se aplican con la misma infraestructura de
 * contadores en D1 (`repositories/rate-limit.ts`).
 */
export const CATALOG_RATE_LIMITS = {
  /** Borrado de la propia tienda: 5 intentos / 15 min por tienda. */
  storeDeleteByOwner: { max: 5, windowMs: 15 * 60 * 1000 },
} as const;

export type CatalogRateLimitOperation = keyof typeof CATALOG_RATE_LIMITS;

/** Sub-códigos estables que viajan en `error.reason` (contrato frontend). */
export const CATALOG_REASONS = {
  storeUnavailable: "STORE_UNAVAILABLE",
  productNotFound: "PRODUCT_NOT_FOUND",
  productSlugTaken: "PRODUCT_SLUG_TAKEN",
  productDeleted: "PRODUCT_DELETED",
  categoryNotFound: "CATEGORY_NOT_FOUND",
  categorySlugTaken: "CATEGORY_SLUG_TAKEN",
  heroNotFound: "HERO_NOT_FOUND",
  heroLimit: "HERO_LIMIT_REACHED",
  heroCtaIncomplete: "HERO_CTA_INCOMPLETE",
  imageLimit: "IMAGE_LIMIT_REACHED",
  imageNotFound: "IMAGE_NOT_FOUND",
  imageType: "IMAGE_TYPE_INVALID",
  imageTooLarge: "IMAGE_TOO_LARGE",
  imageDimensions: "IMAGE_DIMENSIONS_INVALID",
  imageMissing: "IMAGE_MISSING",
  reorderMismatch: "REORDER_MISMATCH",
  confirmSlugMismatch: "CONFIRM_SLUG_MISMATCH",
  invalidPassword: "INVALID_PASSWORD",
  suspendedByAdmin: "STORE_SUSPENDED_BY_ADMIN",
  mediaBaseMissing: "MEDIA_BASE_URL_MISSING",
  storageError: "STORAGE_ERROR",
  consoleStoreNotFound: "CONSOLE_STORE_NOT_FOUND",
  rateLimited: "RATE_LIMITED",
} as const;

export type CatalogReason = (typeof CATALOG_REASONS)[keyof typeof CATALOG_REASONS];

/** Mensajes en español listos para usuario final (PLAN §8.3). */
export const CATALOG_MESSAGES = {
  storeUnavailable: "La tienda no está disponible.",
  storeNotFound: "La tienda no existe.",
  productNotFound: "El producto no existe.",
  productSlugTaken: "Ya tienes un producto con ese identificador.",
  categoryNotFound: "La categoría no existe.",
  categorySlugTaken: "Ya tienes una categoría con ese identificador.",
  heroNotFound: "El slide no existe.",
  heroLimit: `No puedes tener más de ${MEDIA_LIMITS.heroSlides} slides.`,
  heroCtaIncomplete: "El botón necesita texto y enlace, o ninguno de los dos.",
  imageLimit: `Un producto admite como máximo ${MEDIA_LIMITS.productImages} imágenes.`,
  imageNotFound: "La imagen no existe.",
  imageType: "La imagen debe ser WebP.",
  imageTooLarge: "La imagen supera el máximo de 2 MB.",
  imageDimensions: "Las dimensiones de la imagen no son válidas.",
  imageMissing: "Falta una de las imágenes obligatorias.",
  reorderMismatch: "El orden enviado no coincide con los elementos de la tienda.",
  confirmSlugMismatch: "El identificador no coincide con el de la tienda.",
  invalidPassword: "La contraseña no es correcta.",
  suspendedByAdmin: "La tienda fue suspendida por el equipo de TuCatálogo.",
  mediaBaseMissing: "Configuración de media incompleta en el servidor.",
  storageError: "No pudimos guardar los archivos. Inténtalo de nuevo.",
  consoleStoreNotFound: "La tienda no existe.",
  invalidPayload: "Revisa los datos del formulario.",
  rateLimited: "Demasiados intentos. Inténtalo más tarde.",
} as const;

/** Acciones de `audit_log` que escribe la API (PLAN §6.11). */
export const AUDIT_ACTIONS = {
  storeSuspend: "store.suspend",
  storeReactivate: "store.reactivate",
  storeDelete: "store.delete",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
