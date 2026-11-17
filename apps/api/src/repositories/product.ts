/**
 * Repositorio de productos e imágenes (PLAN §6.7 / §6.8).
 *
 * Todas las consultas filtran por `store_id`: un id de otra tienda no devuelve
 * filas jamás (P4). El borrado de producto es lógico (`is_deleted = 1`).
 */
import { and, asc, eq, sql } from "@tucatalogo/db";

import type { Database, Product, ProductImage } from "@tucatalogo/db";
import { productImages, products } from "@tucatalogo/db/schema";

export type ProductStatusFilter = "active" | "inactive" | "all";

export interface ProductFilters {
  q?: string;
  categoryId?: string;
  status?: ProductStatusFilter;
}

/** Escapa los comodines de `LIKE` para que `q` sea texto literal. */
function likePattern(query: string): string {
  const escaped = query.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

function productConditions(storeId: string, filters: ProductFilters) {
  // El borrado lógico siempre se excluye en panel y storefront.
  const conditions = [eq(products.storeId, storeId), eq(products.isDeleted, false)];

  if (filters.status === "active") conditions.push(eq(products.isActive, true));
  if (filters.status === "inactive") conditions.push(eq(products.isActive, false));
  if (filters.categoryId !== undefined) conditions.push(eq(products.categoryId, filters.categoryId));
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(
      sql`(lower(${products.name}) like ${pattern} escape '\\' or lower(${products.slug}) like ${pattern} escape '\\')`,
    );
  }

  return and(...conditions);
}

export interface ProductPage {
  rows: Product[];
  total: number;
}

export async function listProductsPage(
  db: Database,
  storeId: string,
  filters: ProductFilters,
  pagination: { limit: number; offset: number },
): Promise<ProductPage> {
  const where = productConditions(storeId, filters);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.sortOrder), asc(products.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ total: sql<number>`count(*)` }).from(products).where(where),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}

export async function countStoreProducts(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isDeleted, false)));
  return Number(rows[0]?.total ?? 0);
}

export async function getProductById(
  db: Database,
  storeId: string,
  productId: string,
): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(eq(products.storeId, storeId), eq(products.id, productId), eq(products.isDeleted, false)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Producto por slug **vivo** (la unicidad es parcial sobre `is_deleted = 0`). */export async function getProductBySlug(
  db: Database,
  storeId: string,
  slug: string,
  options: { onlyVisible?: boolean } = {},
): Promise<Product | null> {
  const conditions = [
    eq(products.storeId, storeId),
    eq(products.slug, slug),
    eq(products.isDeleted, false),
  ];
  if (options.onlyVisible) conditions.push(eq(products.isActive, true));

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function maxProductSortOrder(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${products.sortOrder}), 0)` })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isDeleted, false)));
  return Number(rows[0]?.value ?? 0);
}

export interface NewProductInput {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  priceMinor: number;
  isActive: boolean;
  sortOrder: number;
  now: Date;
}

export async function insertProduct(db: Database, input: NewProductInput): Promise<Product> {
  const rows = await db
    .insert(products)
    .values({
      id: input.id,
      storeId: input.storeId,
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      priceMinor: input.priceMinor,
      isActive: input.isActive,
      isDeleted: false,
      sortOrder: input.sortOrder,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning();
  return rows[0]!;
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  priceMinor?: number;
  categoryId?: string | null;
  sortOrder?: number;
}

export async function updateProduct(
  db: Database,
  storeId: string,
  productId: string,
  values: ProductUpdate,
  now: Date,
): Promise<Product | null> {
  const rows = await db
    .update(products)
    .set({ ...values, updatedAt: now })
    .where(
      and(eq(products.storeId, storeId), eq(products.id, productId), eq(products.isDeleted, false)),
    )
    .returning();
  return rows[0] ?? null;
}

export async function setProductStatus(
  db: Database,
  storeId: string,
  productId: string,
  isActive: boolean,
  now: Date,
): Promise<Product | null> {
  const rows = await db
    .update(products)
    .set({ isActive, updatedAt: now })
    .where(
      and(eq(products.storeId, storeId), eq(products.id, productId), eq(products.isDeleted, false)),
    )
    .returning();
  return rows[0] ?? null;
}

/** Borrado lógico: las imágenes y sus objetos R2 se conservan (PLAN §6.13). */
export async function softDeleteProduct(
  db: Database,
  storeId: string,
  productId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(products)
    .set({ isDeleted: true, updatedAt: now })
    .where(
      and(eq(products.storeId, storeId), eq(products.id, productId), eq(products.isDeleted, false)),
    )
    .returning({ id: products.id });
  return rows.length === 1;
}

/**
 * Reordena productos. Solo escribe ids de la tienda: el service comprueba que
 * el conjunto coincide exactamente antes de llamar aquí.
 */
export async function reorderProducts(
  db: Database,
  storeId: string,
  ids: readonly string[],
  now: Date,
): Promise<void> {
  const statements = ids.map((id, index) =>
    db
      .update(products)
      .set({ sortOrder: index, updatedAt: now })
      .where(and(eq(products.storeId, storeId), eq(products.id, id), eq(products.isDeleted, false))),
  );
  if (statements.length === 0) return;
  await db.batch([statements[0]!, ...statements.slice(1)]);
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

function inList(values: readonly string[]) {
  return sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;
}

/** Imágenes de varios productos de la tienda, agrupadas por producto. */
export async function listImagesForProducts(
  db: Database,
  storeId: string,
  productIds: readonly string[],
): Promise<Map<string, ProductImage[]>> {
  const grouped = new Map<string, ProductImage[]>();
  if (productIds.length === 0) return grouped;

  const rows = await db
    .select({ image: productImages })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(products.storeId, storeId), sql`${productImages.productId} in ${inList(productIds)}`))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

  for (const row of rows) {
    const list = grouped.get(row.image.productId) ?? [];
    list.push(row.image);
    grouped.set(row.image.productId, list);
  }
  return grouped;
}

export async function listProductImages(
  db: Database,
  storeId: string,
  productId: string,
): Promise<ProductImage[]> {
  const rows = await db
    .select({ image: productImages })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(products.storeId, storeId), eq(productImages.productId, productId)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
  return rows.map((row) => row.image);
}

export async function countProductImages(db: Database, productId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return Number(rows[0]?.total ?? 0);
}

export async function maxImageSortOrder(db: Database, productId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${productImages.sortOrder}), 0)` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return Number(rows[0]?.value ?? 0);
}

export async function getProductImage(
  db: Database,
  storeId: string,
  productId: string,
  imageId: string,
): Promise<ProductImage | null> {
  const rows = await db
    .select({ image: productImages })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(
      and(
        eq(products.storeId, storeId),
        eq(productImages.productId, productId),
        eq(productImages.id, imageId),
      ),
    )
    .limit(1);
  return rows[0]?.image ?? null;
}

export interface NewProductImageInput {
  id: string;
  productId: string;
  r2Key: string;
  alt: string;
  width: number;
  height: number;
  sortOrder: number;
  now: Date;
}

export async function insertProductImage(
  db: Database,
  input: NewProductImageInput,
): Promise<ProductImage> {
  const rows = await db
    .insert(productImages)
    .values({
      id: input.id,
      productId: input.productId,
      r2Key: input.r2Key,
      alt: input.alt,
      width: input.width,
      height: input.height,
      sortOrder: input.sortOrder,
      createdAt: input.now,
    })
    .returning();
  return rows[0]!;
}

export async function updateProductImage(
  db: Database,
  productId: string,
  imageId: string,
  values: { alt?: string; sortOrder?: number },
): Promise<ProductImage | null> {
  const rows = await db
    .update(productImages)
    .set(values)
    .where(and(eq(productImages.productId, productId), eq(productImages.id, imageId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteProductImage(
  db: Database,
  productId: string,
  imageId: string,
): Promise<boolean> {
  const rows = await db
    .delete(productImages)
    .where(and(eq(productImages.productId, productId), eq(productImages.id, imageId)))
    .returning({ id: productImages.id });
  return rows.length === 1;
}

export async function reorderProductImages(
  db: Database,
  productId: string,
  ids: readonly string[],
): Promise<void> {
  const statements = ids.map((id, index) =>
    db
      .update(productImages)
      .set({ sortOrder: index })
      .where(and(eq(productImages.productId, productId), eq(productImages.id, id))),
  );
  if (statements.length === 0) return;
  await db.batch([statements[0]!, ...statements.slice(1)]);
}

/** Ids de las imágenes del producto (para validar un reordenamiento). */
export async function listProductImageIds(db: Database, storeId: string, productId: string) {
  const rows = await db
    .select({ image: productImages })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(products.storeId, storeId), eq(productImages.productId, productId)));
  return rows.map((row) => row.image.id);
}

/** Ids de los productos vivos de la tienda (validación de un reordenamiento). */
export async function listProductIds(db: Database, storeId: string): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isDeleted, false)));
  return rows.map((row) => row.id);
}

/** Entradas públicas del sitemap: solo activos y vivos (PLAN §8.2). */export async function listPublicProductEntries(
  db: Database,
  storeId: string,
): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(
      and(eq(products.storeId, storeId), eq(products.isDeleted, false), eq(products.isActive, true)),
    )
    .orderBy(asc(products.sortOrder), asc(products.createdAt));
}
