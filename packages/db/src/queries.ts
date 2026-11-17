import { and, asc, eq, getTableColumns, gt } from "drizzle-orm";

import type { Database } from "./client";
import {
  categories,
  heroSlides,
  productImages,
  products,
  slugReservations,
  stores,
} from "../schema/index";

/**
 * Building blocks de consulta para los repositories de `apps/api` (PLAN §8.1).
 *
 * Todos los helpers de datos de tienda reciben `storeId` explícito: no hay
 * consultas "globales" que puedan filtrar de menos (P4: aislamiento por tienda).
 * Las únicas búsquedas sin `storeId` son por clave única (`store.slug`,
 * `slug_reservation.slug`) y las resuelve el servidor, nunca el cliente.
 *
 * Devuelven el builder de Drizzle (thenable) para que el repository pueda
 * añadir `limit`/`offset`/orden de dominio sin duplicar el filtro de tienda.
 */

/** Tienda por slug, para resolución de host en el servidor (PLAN §4.5 D). */
export function findStoreBySlug(db: Database, slug: string) {
  return db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
}

/** Tienda por id resuelto en servidor (sesión). */
export function findStoreById(db: Database, storeId: string) {
  return db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
}

/** Cuarentena vigente de un slug; `now` lo pasa el service. */
export function findActiveSlugReservation(db: Database, slug: string, now: Date) {
  return db
    .select()
    .from(slugReservations)
    .where(and(eq(slugReservations.slug, slug), gt(slugReservations.reservedUntil, now)))
    .limit(1);
}

export function selectStoreCategories(db: Database, storeId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export interface StoreProductFilters {
  /** Filtra por categoría; `undefined` = todas. */
  categoryId?: string;
  /** Por defecto `false`: solo productos vivos. */
  includeDeleted?: boolean;
  /** Por defecto `false`: solo productos visibles en la tienda. */
  includeInactive?: boolean;
}

/** Productos de una tienda, sin paginar: el repository aplica `limit`/`offset`. */
export function selectStoreProducts(
  db: Database,
  storeId: string,
  filters: StoreProductFilters = {},
) {
  const conditions = [eq(products.storeId, storeId)];

  if (filters.categoryId !== undefined) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  if (filters.includeDeleted !== true) {
    conditions.push(eq(products.isDeleted, false));
  }
  if (filters.includeInactive !== true) {
    conditions.push(eq(products.isActive, true));
  }

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.sortOrder), asc(products.createdAt));
}

/** Ficha pública por slug: siempre `is_active = 1 AND is_deleted = 0`. */
export function findStoreProductBySlug(db: Database, storeId: string, slug: string) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.slug, slug),
        eq(products.isActive, true),
        eq(products.isDeleted, false),
      ),
    )
    .limit(1);
}

export interface HeroSlideFilters {
  /** Por defecto `true`: solo slides activos para el storefront. */
  onlyActive?: boolean;
}

export function selectStoreHeroSlides(
  db: Database,
  storeId: string,
  filters: HeroSlideFilters = {},
) {
  const conditions = [eq(heroSlides.storeId, storeId)];

  if (filters.onlyActive !== false) {
    conditions.push(eq(heroSlides.isActive, true));
  }

  return db
    .select()
    .from(heroSlides)
    .where(and(...conditions))
    .orderBy(asc(heroSlides.sortOrder));
}

/**
 * Imágenes de un producto verificando que el producto pertenece a la tienda:
 * un `productId` de otra tienda devuelve lista vacía, nunca datos ajenos.
 */
export function selectStoreProductImages(
  db: Database,
  storeId: string,
  productId: string,
) {
  return db
    .select(getTableColumns(productImages))
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(products.storeId, storeId), eq(productImages.productId, productId)))
    .orderBy(asc(productImages.sortOrder));
}
