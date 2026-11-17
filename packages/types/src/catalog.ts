import { z } from "zod";

import { STORE_SLUG_REGEX } from "./slug";
import {
  COLOR_MODES,
  CURRENCIES,
  STORE_STATUSES,
  SUSPENDED_BY,
  colorModeSchema,
  currencySchema,
  storeStatusSchema,
  suspendedBySchema,
} from "./store";

/**
 * Contratos del catálogo, del panel y del console (PLAN §8.2 / §8.4).
 *
 * Los mismos schemas los usan el API (validación de entrada y de salida) y los
 * frontends (`packages/api-client`). Ningún schema acepta `storeId`: la tienda
 * la resuelve siempre el servidor.
 */

/** Id interno (UUID del API). Se acepta cualquier texto corto: nunca se confía en él para filtrar. */
export const resourceIdSchema = z.string().trim().min(1).max(64);

/** Slug de producto o categoría: mismo alfabeto que el de tienda. */
export const catalogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(STORE_SLUG_REGEX, "Solo minúsculas, números y guiones, sin guion final");

/** Texto opcional de query: `?q=` vacío se trata como ausente. */
function optionalQueryText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
}

export const pageQuerySchema = z.coerce.number().int().min(1).max(10_000).default(1);

/** Paginación de respuesta. `pageSize` lo fija el API, nunca el cliente. */
export const paginationShape = {
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
} as const;

export const paginationSchema = z.object(paginationShape);

/** URL de CTA del hero: `https://…` absoluta o ruta relativa del storefront. */
export const ctaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^https:\/\/[^\s]+$/i.test(value) || /^\/(?!\/)[^\s]*$/.test(value),
    "El enlace debe empezar por https:// o por /",
  );

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const mediaImageSchema = z.object({
  id: z.string(),
  alt: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  sortOrder: z.number().int(),
  fullUrl: z.string(),
  thumbUrl: z.string(),
});
export type MediaImage = z.infer<typeof mediaImageSchema>;

// ---------------------------------------------------------------------------
// Público (consumido solo por `web` vía service binding)
// ---------------------------------------------------------------------------

export const publicStoreSchema = z.object({
  slug: z.string(),
  name: z.string(),
  themeId: z.string(),
  primaryColor: z.string(),
  colorModeDefault: colorModeSchema,
  currency: currencySchema,
  whatsappNumber: z.string().nullable(),
  whatsappMessageTemplate: z.string().nullable(),
  logoUrl: z.string().nullable(),
  updatedAt: z.string(),
});
export type PublicStore = z.infer<typeof publicStoreSchema>;

export const publicHeroSlideSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  ctaUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  desktopUrl: z.string(),
  mobileUrl: z.string(),
});
export type PublicHeroSlide = z.infer<typeof publicHeroSlideSchema>;

export const publicHeroSchema = z.object({ items: z.array(publicHeroSlideSchema) });
export type PublicHero = z.infer<typeof publicHeroSchema>;

export const publicProductsQuerySchema = z.object({
  category: optionalQueryText(80),
  q: optionalQueryText(80),
  page: pageQuerySchema,
});
export type PublicProductsQuery = z.infer<typeof publicProductsQuerySchema>;

export const publicProductCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  priceMinor: z.number().int(),
  currency: currencySchema,
  categorySlug: z.string().nullable(),
  sortOrder: z.number().int(),
  image: mediaImageSchema.nullable(),
});
export type PublicProductCard = z.infer<typeof publicProductCardSchema>;

export const publicProductListSchema = z.object({
  items: z.array(publicProductCardSchema),
  ...paginationShape,
});
export type PublicProductList = z.infer<typeof publicProductListSchema>;

export const productCategoryRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type ProductCategoryRef = z.infer<typeof productCategoryRefSchema>;

export const publicProductDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  priceMinor: z.number().int(),
  currency: currencySchema,
  category: productCategoryRefSchema.nullable(),
  sortOrder: z.number().int(),
  images: z.array(mediaImageSchema),
  whatsappUrl: z.string().nullable(),
  updatedAt: z.string(),
});
export type PublicProductDetail = z.infer<typeof publicProductDetailSchema>;

export const publicSitemapSchema = z.object({
  categories: z.array(z.object({ slug: z.string(), updatedAt: z.string() })),
  products: z.array(z.object({ slug: z.string(), updatedAt: z.string() })),
});
export type PublicSitemap = z.infer<typeof publicSitemapSchema>;

// ---------------------------------------------------------------------------
// Panel del dueño
// ---------------------------------------------------------------------------

export const panelStoreSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: storeStatusSchema,
  suspendedBy: suspendedBySchema.nullable(),
  suspendedReason: z.string().nullable(),
  suspendedAt: z.string().nullable(),
  themeId: z.string(),
  primaryColor: z.string(),
  colorModeDefault: colorModeSchema,
  currency: currencySchema,
  whatsappNumber: z.string().nullable(),
  whatsappMessageTemplate: z.string().nullable(),
  logoKey: z.string().nullable(),
  logoUrl: z.string().nullable(),
  plan: z.string(),
  owner: z.object({ id: z.string(), email: z.string(), name: z.string() }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PanelStore = z.infer<typeof panelStoreSchema>;

export const panelStoreUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe el nombre de la tienda").max(80).optional(),
    themeId: z.string().trim().min(1).max(40).optional(),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un hex #RRGGBB")
      .optional(),
    colorModeDefault: colorModeSchema.optional(),
    currency: currencySchema.optional(),
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^\d{8,15}$/, "El WhatsApp debe llevar código de país, sin +")
      .nullable()
      .optional(),
    whatsappMessageTemplate: z.string().trim().min(1).max(300).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No hay cambios que guardar.",
  });
export type PanelStoreUpdateInput = z.infer<typeof panelStoreUpdateSchema>;

export const panelStoreLogoResponseSchema = z.object({
  logoKey: z.string(),
  logoUrl: z.string(),
});
export type PanelStoreLogoResponse = z.infer<typeof panelStoreLogoResponseSchema>;

export const panelSuspendStoreSchema = z.object({
  reason: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(300).optional(),
  ),
});
export type PanelSuspendStoreInput = z.infer<typeof panelSuspendStoreSchema>;

export const panelDeleteStoreSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña").max(128),
  confirmSlug: z.string().trim().min(1, "Escribe el identificador de la tienda"),
});
export type PanelDeleteStoreInput = z.infer<typeof panelDeleteStoreSchema>;

export const panelProductsQuerySchema = z.object({
  q: optionalQueryText(80),
  category: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    resourceIdSchema.optional(),
  ),
  status: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.enum(["active", "inactive", "all"]).optional(),
    )
    .default("all"),
  page: pageQuerySchema,
});
export type PanelProductsQuery = z.infer<typeof panelProductsQuerySchema>;

export const productCreateSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del producto").max(120),
  slug: catalogSlugSchema,
  description: z.string().trim().max(2000).nullable().optional(),
  priceMinor: z.number().int("El precio va en unidad mínima").min(0).max(100_000_000),
  categoryId: resourceIdSchema.nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: catalogSlugSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    priceMinor: z.number().int().min(0).max(100_000_000).optional(),
    categoryId: resourceIdSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No hay cambios que guardar.",
  });
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productStatusSchema = z.object({ isActive: z.boolean() });
export type ProductStatusInput = z.infer<typeof productStatusSchema>;

export const reorderSchema = z.object({
  ids: z.array(resourceIdSchema).min(1).max(500),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const panelProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  priceMinor: z.number().int(),
  currency: currencySchema,
  categoryId: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  images: z.array(mediaImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PanelProduct = z.infer<typeof panelProductSchema>;

export const panelProductListSchema = z.object({
  items: z.array(panelProductSchema),
  ...paginationShape,
});
export type PanelProductList = z.infer<typeof panelProductListSchema>;

export const productImageUpdateSchema = z
  .object({
    alt: z.string().trim().min(1, "Describe la imagen").max(180).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No hay cambios que guardar.",
  });
export type ProductImageUpdateInput = z.infer<typeof productImageUpdateSchema>;

export const productImageOrderSchema = z.object({
  ids: z.array(resourceIdSchema).min(1).max(8),
});
export type ProductImageOrderInput = z.infer<typeof productImageOrderSchema>;

/** Campos de texto del multipart `POST /panel/products/:id/images`. */
export const productImageFormSchema = z.object({
  alt: z.string().trim().min(1, "Describe la imagen").max(180),
  width: z.coerce.number().int().min(1).max(20_000).optional(),
  height: z.coerce.number().int().min(1).max(20_000).optional(),
});
export type ProductImageFormInput = z.infer<typeof productImageFormSchema>;

/** Campos de texto del multipart `POST /panel/hero` y `/panel/hero/:id/images`. */
export const heroFormSchema = z.object({
  title: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(200).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaUrl: ctaUrlSchema.optional(),
  isActive: z.enum(["true", "false", "1", "0"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});
export type HeroFormInput = z.infer<typeof heroFormSchema>;

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la categoría").max(80),
  slug: catalogSlugSchema,
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    slug: catalogSlugSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No hay cambios que guardar.",
  });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const panelCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().int(),
  productCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PanelCategory = z.infer<typeof panelCategorySchema>;

export const panelCategoryListSchema = z.object({ items: z.array(panelCategorySchema) });
export type PanelCategoryList = z.infer<typeof panelCategoryListSchema>;

export const heroUpdateSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    subtitle: z.string().trim().max(200).nullable().optional(),
    ctaLabel: z.string().trim().max(40).nullable().optional(),
    ctaUrl: ctaUrlSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No hay cambios que guardar.",
  });
export type HeroUpdateInput = z.infer<typeof heroUpdateSchema>;

export const panelHeroSlideSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  ctaUrl: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  desktopUrl: z.string(),
  mobileUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PanelHeroSlide = z.infer<typeof panelHeroSlideSchema>;

export const panelHeroListSchema = z.object({
  items: z.array(panelHeroSlideSchema),
  limit: z.number().int(),
});
export type PanelHeroList = z.infer<typeof panelHeroListSchema>;

export const heroReorderSchema = z.object({
  ids: z.array(resourceIdSchema).min(1).max(10),
});
export type HeroReorderInput = z.infer<typeof heroReorderSchema>;

// ---------------------------------------------------------------------------
// Console (backoffice SaaS)
// ---------------------------------------------------------------------------

export const consoleStoresQuerySchema = z.object({
  q: optionalQueryText(120),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    storeStatusSchema.optional(),
  ),
  page: pageQuerySchema,
});
export type ConsoleStoresQuery = z.infer<typeof consoleStoresQuerySchema>;

export const consoleStoreListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: storeStatusSchema,
  suspendedBy: suspendedBySchema.nullable(),
  suspendedAt: z.string().nullable(),
  ownerEmail: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConsoleStoreListItem = z.infer<typeof consoleStoreListItemSchema>;

export const consoleStoreListSchema = z.object({
  items: z.array(consoleStoreListItemSchema),
  ...paginationShape,
});
export type ConsoleStoreList = z.infer<typeof consoleStoreListSchema>;

export const consoleStoreDetailSchema = consoleStoreListItemSchema.extend({
  suspendedReason: z.string().nullable(),
  themeId: z.string(),
  primaryColor: z.string(),
  colorModeDefault: colorModeSchema,
  currency: currencySchema,
  plan: z.string(),
  whatsappNumber: z.string().nullable(),
  owner: z.object({ id: z.string(), email: z.string(), name: z.string() }),
  productCount: z.number().int(),
  categoryCount: z.number().int(),
  slideCount: z.number().int(),
  imageCount: z.number().int(),
});
export type ConsoleStoreDetail = z.infer<typeof consoleStoreDetailSchema>;

export const consoleSuspendStoreSchema = z.object({
  reason: z.string().trim().min(3, "Escribe el motivo de la suspensión").max(300),
});
export type ConsoleSuspendStoreInput = z.infer<typeof consoleSuspendStoreSchema>;

export const consoleDeleteStoreSchema = z.object({
  confirmSlug: z.string().trim().min(1, "Escribe el identificador de la tienda"),
});
export type ConsoleDeleteStoreInput = z.infer<typeof consoleDeleteStoreSchema>;

export const consoleAuditQuerySchema = z.object({
  storeId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    resourceIdSchema.optional(),
  ),
  action: optionalQueryText(60),
  page: pageQuerySchema,
});
export type ConsoleAuditQuery = z.infer<typeof consoleAuditQuerySchema>;

export const auditEntrySchema = z.object({
  id: z.string(),
  actorType: z.enum(["admin", "owner", "system"]),
  actorId: z.string().nullable(),
  storeId: z.string().nullable(),
  storeSlug: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const consoleAuditListSchema = z.object({
  items: z.array(auditEntrySchema),
  ...paginationShape,
});
export type ConsoleAuditList = z.infer<typeof consoleAuditListSchema>;

/** Catálogos del panel (tema y moneda) expuestos al frontend sin duplicarlos. */
export const catalogEnumsSchema = z.object({
  currencies: z.array(z.enum(CURRENCIES)),
  colorModes: z.array(z.enum(COLOR_MODES)),
  statuses: z.array(z.enum(STORE_STATUSES)),
  suspendedBy: z.array(z.enum(SUSPENDED_BY)),
});
