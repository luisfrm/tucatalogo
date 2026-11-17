/**
 * Repositorio del console (PLAN §11): lectura de tiendas para el backoffice.
 *
 * El console solo ve **metadatos**: nunca productos ni imágenes editables
 * (PLAN §7.8). Los conteos son agregados, no contenido.
 */
import { and, desc, eq, sql } from "@tucatalogo/db";

import type { Database, Store } from "@tucatalogo/db";
import {
  categories,
  heroSlides,
  productImages,
  products,
  stores,
  storeUsers,
  type StoreStatus,
} from "@tucatalogo/db/schema";

export interface ConsoleStoreFilters {
  q?: string;
  status?: StoreStatus;
}

export interface ConsoleStoreRow {
  store: Store;
  ownerEmail: string;
}

export interface ConsoleStorePage {
  rows: ConsoleStoreRow[];
  total: number;
}

function likePattern(query: string): string {
  const escaped = query.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

function storeConditions(filters: ConsoleStoreFilters) {
  const conditions = [];
  if (filters.status) conditions.push(eq(stores.status, filters.status));
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(
      sql`(lower(${stores.slug}) like ${pattern} escape '\\' or lower(${stores.name}) like ${pattern} escape '\\' or lower(${storeUsers.email}) like ${pattern} escape '\\')`,
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listConsoleStores(
  db: Database,
  filters: ConsoleStoreFilters,
  pagination: { limit: number; offset: number },
): Promise<ConsoleStorePage> {
  const where = storeConditions(filters);

  const [rows, totalRows] = await Promise.all([
    db
      .select({ store: stores, ownerEmail: storeUsers.email })
      .from(stores)
      .innerJoin(storeUsers, eq(storeUsers.id, stores.ownerId))
      .where(where)
      .orderBy(desc(stores.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(stores)
      .innerJoin(storeUsers, eq(storeUsers.id, stores.ownerId))
      .where(where),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}

export interface ConsoleStoreCounts {
  productCount: number;
  categoryCount: number;
  slideCount: number;
  imageCount: number;
}

export async function getConsoleStore(
  db: Database,
  storeId: string,
): Promise<{ store: Store; owner: { id: string; email: string; name: string }; counts: ConsoleStoreCounts } | null> {
  const rows = await db
    .select()
    .from(stores)
    .innerJoin(storeUsers, eq(storeUsers.id, stores.ownerId))
    .where(eq(stores.id, storeId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [productTotal, categoryTotal, slideTotal, imageTotal] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.isDeleted, false))),
    db.select({ total: sql<number>`count(*)` }).from(categories).where(eq(categories.storeId, storeId)),
    db.select({ total: sql<number>`count(*)` }).from(heroSlides).where(eq(heroSlides.storeId, storeId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(productImages)
      .innerJoin(products, eq(products.id, productImages.productId))
      .where(eq(products.storeId, storeId)),
  ]);

  return {
    store: row.store,
    owner: { id: row.store_users.id, email: row.store_users.email, name: row.store_users.name },
    counts: {
      productCount: Number(productTotal[0]?.total ?? 0),
      categoryCount: Number(categoryTotal[0]?.total ?? 0),
      slideCount: Number(slideTotal[0]?.total ?? 0),
      imageCount: Number(imageTotal[0]?.total ?? 0),
    },
  };
}
