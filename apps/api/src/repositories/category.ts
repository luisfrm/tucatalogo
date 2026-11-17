/**
 * Repositorio de categorías (PLAN §6.6). `slug` es único por tienda.
 * Borrar una categoría deja los productos con `category_id = NULL`.
 */
import { and, asc, eq, sql } from "@tucatalogo/db";

import type { Category, Database } from "@tucatalogo/db";
import { categories, products } from "@tucatalogo/db/schema";

export interface CategoryWithCount extends Category {
  productCount: number;
}

export async function listCategories(db: Database, storeId: string): Promise<CategoryWithCount[]> {
  const rows = await db
    .select({
      category: categories,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(
        eq(products.categoryId, categories.id),
        eq(products.storeId, storeId),
        eq(products.isDeleted, false),
      ),
    )
    .where(eq(categories.storeId, storeId))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return rows.map((row) => ({ ...row.category, productCount: Number(row.productCount ?? 0) }));
}

export async function countStoreCategories(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(categories)
    .where(eq(categories.storeId, storeId));
  return Number(rows[0]?.total ?? 0);
}

export async function getCategoryById(
  db: Database,
  storeId: string,
  categoryId: string,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCategoryBySlug(
  db: Database,
  storeId: string,
  slug: string,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function maxCategorySortOrder(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
    .from(categories)
    .where(eq(categories.storeId, storeId));
  return Number(rows[0]?.value ?? 0);
}

export interface NewCategoryInput {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  sortOrder: number;
  now: Date;
}

export async function insertCategory(db: Database, input: NewCategoryInput): Promise<Category> {
  const rows = await db
    .insert(categories)
    .values({
      id: input.id,
      storeId: input.storeId,
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning();
  return rows[0]!;
}

export async function updateCategory(
  db: Database,
  storeId: string,
  categoryId: string,
  values: { name?: string; slug?: string; sortOrder?: number },
  now: Date,
): Promise<Category | null> {
  const rows = await db
    .update(categories)
    .set({ ...values, updatedAt: now })
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Borra la categoría y desasigna sus productos en el mismo batch. La FK ya es
 * `ON DELETE SET NULL`, pero se explicita para que el orden sea el del PLAN.
 */
export async function deleteCategory(
  db: Database,
  storeId: string,
  categoryId: string,
  now: Date,
): Promise<boolean> {
  const existing = await getCategoryById(db, storeId, categoryId);
  if (!existing) return false;

  await db.batch([
    db
      .update(products)
      .set({ categoryId: null, updatedAt: now })
      .where(and(eq(products.storeId, storeId), eq(products.categoryId, categoryId))),
    db.delete(categories).where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId))),
  ]);
  return true;
}

/** Entradas públicas del sitemap: todas las categorías de la tienda. */
export async function listPublicCategoryEntries(
  db: Database,
  storeId: string,
): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: categories.slug, updatedAt: categories.updatedAt })
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
