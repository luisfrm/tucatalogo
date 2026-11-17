/**
 * Servicio de productos e imágenes (PLAN §6.7, §6.8, §8.2, §8.5).
 *
 * - El `storeId` viene resuelto del contexto (sesión o slug), nunca del body.
 * - Un `categoryId` o `productId` de otra tienda no existe para esta tienda.
 * - Imagen: R2 primero, D1 después. Si R2 falla → 502 y no se inserta la fila.
 */
import type { Database, Product, ProductImage, Store } from "@tucatalogo/db";
import type { Currency } from "@tucatalogo/types";
import type {
  MediaImage,
  PanelProduct,
  PanelProductList,
  PanelProductsQuery,
  ProductCreateInput,
  ProductUpdateInput,
  PublicProductDetail,
  PublicProductList,
  PublicProductsQuery,
} from "@tucatalogo/types";

import {
  CATALOG_MESSAGES,
  CATALOG_REASONS,
  MEDIA_LIMITS,
  PAGE_SIZE,
} from "../constants/catalog";
import type { Env } from "../env";
import { AppError } from "../errors";
import type { ImageUpload } from "../libs/media";
import { productImageKeyBase, productImageObjects } from "../libs/media";
import { priceLabel } from "../libs/money";
import { buildWhatsappUrl } from "../libs/whatsapp";
import { getCategoryById, getCategoryBySlug, listCategories, listPublicCategoryEntries } from "../repositories/category";
import {
  countProductImages,
  getProductById,
  getProductBySlug,
  getProductImage,
  insertProduct,
  insertProductImage,
  listImagesForProducts,
  listProductImageIds,
  listProductImages,
  listProductIds,
  listProductsPage,
  listPublicProductEntries,
  maxImageSortOrder,
  maxProductSortOrder,
  reorderProductImages,
  reorderProducts,
  setProductStatus,
  softDeleteProduct,
  updateProduct as updateProductRow,
  updateProductImage,
  deleteProductImage,
} from "../repositories/product";
import { assertStoreReadable } from "./store";
import { removeMediaObject, removeMediaObjects, storeMediaObject, toMediaUrl } from "./media";
import { pageWindow } from "../libs/pagination";

/** URL de una imagen de producto (full + thumb derivados de `r2_key`). */
export function toMediaImage(env: Env, image: ProductImage): MediaImage {
  const objects = productImageObjects(image.r2Key);
  const fullUrl = toMediaUrl(env, objects.full);
  const thumbUrl = toMediaUrl(env, objects.thumb);
  if (!fullUrl || !thumbUrl) {
    throw new AppError("INTERNAL", "No pudimos construir la URL de la imagen.");
  }
  return {
    id: image.id,
    alt: image.alt,
    width: image.width,
    height: image.height,
    sortOrder: image.sortOrder,
    fullUrl,
    thumbUrl,
  };
}

function currencyOf(store: Store): Currency {
  return store.currency as Currency;
}

function conflictSlug(): AppError {
  return new AppError(
    "CONFLICT",
    CATALOG_MESSAGES.productSlugTaken,
    [{ path: "slug", message: CATALOG_MESSAGES.productSlugTaken }],
    CATALOG_REASONS.productSlugTaken,
  );
}

function translateUniqueViolation(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("product_store_slug_uq") || message.includes("product.slug")) {
    throw conflictSlug();
  }
  throw error;
}

async function assertCategoryOfStore(
  db: Database,
  storeId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (categoryId === undefined || categoryId === null) return;
  const category = await getCategoryById(db, storeId, categoryId);
  if (!category) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.categoryNotFound,
      [{ path: "categoryId", message: CATALOG_MESSAGES.categoryNotFound }],
      CATALOG_REASONS.categoryNotFound,
    );
  }
}

async function assertSlugAvailable(
  db: Database,
  storeId: string,
  slug: string,
  ignoreProductId?: string,
): Promise<void> {
  const existing = await getProductBySlug(db, storeId, slug);
  if (existing && existing.id !== ignoreProductId) {
    throw conflictSlug();
  }
}

export function toPanelProduct(
  env: Env,
  store: Store,
  product: Product,
  images: ProductImage[],
): PanelProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceMinor: product.priceMinor,
    currency: currencyOf(store),
    categoryId: product.categoryId,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    images: images.map((image) => toMediaImage(env, image)),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function listPanelProducts(
  env: Env,
  db: Database,
  store: Store,
  query: PanelProductsQuery,
): Promise<PanelProductList> {
  if (query.category) {
    const category = await getCategoryById(db, store.id, query.category);
    if (!category) {
      throw new AppError("NOT_FOUND", CATALOG_MESSAGES.categoryNotFound);
    }
  }

  const { rows, total } = await listProductsPage(
    db,
    store.id,
    { q: query.q, categoryId: query.category, status: query.status },
    pageWindow(query.page, PAGE_SIZE.panel),
  );

  const images = await listImagesForProducts(
    db,
    store.id,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => toPanelProduct(env, store, row, images.get(row.id) ?? [])),
    page: query.page,
    pageSize: PAGE_SIZE.panel,
    total,
    hasMore: query.page * PAGE_SIZE.panel < total,
  };
}

async function loadProduct(
  db: Database,
  storeId: string,
  productId: string,
): Promise<Product> {
  const product = await getProductById(db, storeId, productId);
  if (!product) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.productNotFound,
      undefined,
      CATALOG_REASONS.productNotFound,
    );
  }
  return product;
}

export async function getPanelProduct(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
): Promise<PanelProduct> {
  const product = await loadProduct(db, store.id, productId);
  const images = await listProductImages(db, store.id, productId);
  return toPanelProduct(env, store, product, images);
}

export async function createProduct(
  env: Env,
  db: Database,
  store: Store,
  input: ProductCreateInput,
): Promise<PanelProduct> {
  await assertCategoryOfStore(db, store.id, input.categoryId);
  await assertSlugAvailable(db, store.id, input.slug);

  const sortOrder = input.sortOrder ?? (await maxProductSortOrder(db, store.id)) + 1;
  const now = new Date();

  let product: Product;
  try {
    product = await insertProduct(db, {
      id: crypto.randomUUID(),
      storeId: store.id,
      categoryId: input.categoryId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      priceMinor: input.priceMinor,
      isActive: input.isActive,
      sortOrder,
      now,
    });
  } catch (error) {
    translateUniqueViolation(error);
  }

  return toPanelProduct(env, store, product, []);
}

export async function updateProduct(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  input: ProductUpdateInput,
): Promise<PanelProduct> {
  await loadProduct(db, store.id, productId);
  await assertCategoryOfStore(db, store.id, input.categoryId);
  if (input.slug !== undefined) {
    await assertSlugAvailable(db, store.id, input.slug, productId);
  }

  let updated: Product | null;
  try {
    updated = await updateProductRow(
      db,
      store.id,
      productId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priceMinor !== undefined ? { priceMinor: input.priceMinor } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      new Date(),
    );
  } catch (error) {
    translateUniqueViolation(error);
  }

  if (!updated) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.productNotFound,
      undefined,
      CATALOG_REASONS.productNotFound,
    );
  }

  const images = await listProductImages(db, store.id, productId);
  return toPanelProduct(env, store, updated, images);
}

export async function setPanelProductStatus(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  isActive: boolean,
): Promise<PanelProduct> {
  const updated = await setProductStatus(db, store.id, productId, isActive, new Date());
  if (!updated) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.productNotFound,
      undefined,
      CATALOG_REASONS.productNotFound,
    );
  }
  const images = await listProductImages(db, store.id, productId);
  return toPanelProduct(env, store, updated, images);
}

/** Borrado lógico (`is_deleted = 1`): las imágenes se conservan (PLAN §6.13). */
export async function deletePanelProduct(
  db: Database,
  storeId: string,
  productId: string,
): Promise<void> {
  const deleted = await softDeleteProduct(db, storeId, productId, new Date());
  if (!deleted) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.productNotFound,
      undefined,
      CATALOG_REASONS.productNotFound,
    );
  }
}

export async function reorderStoreProducts(
  db: Database,
  storeId: string,
  ids: readonly string[],
): Promise<void> {
  const existing = new Set(await listProductIds(db, storeId));
  const requested = new Set(ids);
  if (existing.size !== requested.size || [...requested].some((id) => !existing.has(id))) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.reorderMismatch,
      [{ path: "ids", message: CATALOG_MESSAGES.reorderMismatch }],
      CATALOG_REASONS.reorderMismatch,
    );
  }
  await reorderProducts(db, storeId, ids, new Date());
}

// ---------------------------------------------------------------------------
// Imágenes de producto
// ---------------------------------------------------------------------------

export interface ProductImageUpload {
  full: ImageUpload;
  thumb: ImageUpload;
  alt: string;
  /** Dimensiones declaradas por el navegador; si no coinciden → 400. */
  declared?: { width?: number; height?: number };
}

export async function addProductImage(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  upload: ProductImageUpload,
): Promise<MediaImage> {
  await loadProduct(db, store.id, productId);

  const existing = await countProductImages(db, productId);
  if (existing >= MEDIA_LIMITS.productImages) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.imageLimit,
      [{ path: "images", message: CATALOG_MESSAGES.imageLimit }],
      CATALOG_REASONS.imageLimit,
    );
  }

  if (
    upload.declared?.width !== undefined &&
    upload.declared.width !== upload.full.width
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.imageDimensions,
      [{ path: "width", message: CATALOG_MESSAGES.imageDimensions }],
      CATALOG_REASONS.imageDimensions,
    );
  }
  if (
    upload.declared?.height !== undefined &&
    upload.declared.height !== upload.full.height
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.imageDimensions,
      [{ path: "height", message: CATALOG_MESSAGES.imageDimensions }],
      CATALOG_REASONS.imageDimensions,
    );
  }

  const keyBase = productImageKeyBase(store.id, productId);
  const objects = productImageObjects(keyBase);

  // R2 primero: si el thumb falla, se retira el full y **no** se inserta fila.
  await storeMediaObject(env, objects.full, upload.full.bytes);
  try {
    await storeMediaObject(env, objects.thumb, upload.thumb.bytes);
  } catch (error) {
    await removeMediaObjects(env, [objects.full]);
    throw error;
  }

  const sortOrder = (await maxImageSortOrder(db, productId)) + 1;
  let image: ProductImage;
  try {
    image = await insertProductImage(db, {
      id: crypto.randomUUID(),
      productId,
      r2Key: keyBase,
      alt: upload.alt,
      width: upload.full.width,
      height: upload.full.height,
      sortOrder,
      now: new Date(),
    });
  } catch (error) {
    await removeMediaObjects(env, [objects.full, objects.thumb]);
    throw error;
  }

  return toMediaImage(env, image);
}

export async function updatePanelImage(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  imageId: string,
  values: { alt?: string; sortOrder?: number },
): Promise<MediaImage> {
  await loadProduct(db, store.id, productId);
  const image = await getProductImage(db, store.id, productId, imageId);
  if (!image) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.imageNotFound,
      undefined,
      CATALOG_REASONS.imageNotFound,
    );
  }

  const updated = await updateProductImage(db, productId, imageId, values);
  if (!updated) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.imageNotFound,
      undefined,
      CATALOG_REASONS.imageNotFound,
    );
  }
  return toMediaImage(env, updated);
}

/** Borra los dos objetos y después la fila. Si R2 falla, la fila sigue viva. */
export async function deletePanelImage(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  imageId: string,
): Promise<void> {
  await loadProduct(db, store.id, productId);
  const image = await getProductImage(db, store.id, productId, imageId);
  if (!image) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.imageNotFound,
      undefined,
      CATALOG_REASONS.imageNotFound,
    );
  }

  const objects = productImageObjects(image.r2Key);
  // Sin best-effort: un fallo aquí debe abortar con 502 y no dejar la fila rota.
  await removeMediaObjectsStrict(env, [objects.full, objects.thumb]);

  const deleted = await deleteProductImage(db, productId, imageId);
  if (!deleted) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.imageNotFound,
      undefined,
      CATALOG_REASONS.imageNotFound,
    );
  }
}

async function removeMediaObjectsStrict(env: Env, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    // Un fallo de R2 aquí es 502 y la fila de D1 no se toca.
    await removeMediaObject(env, key);
  }
}

export async function reorderPanelImages(
  env: Env,
  db: Database,
  store: Store,
  productId: string,
  ids: readonly string[],
): Promise<PanelProduct> {
  await loadProduct(db, store.id, productId);
  const existing = await listProductImageIds(db, store.id, productId);
  const requested = new Set(ids);
  if (existing.length !== requested.size || existing.some((id) => !requested.has(id))) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.reorderMismatch,
      [{ path: "ids", message: CATALOG_MESSAGES.reorderMismatch }],
      CATALOG_REASONS.reorderMismatch,
    );
  }

  await reorderProductImages(db, productId, ids);
  return getPanelProduct(env, db, store, productId);
}

// ---------------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------------

export async function listPublicProducts(
  env: Env,
  db: Database,
  store: Store,
  query: PublicProductsQuery,
): Promise<PublicProductList> {
  assertStoreReadable(store);

  let categoryId: string | undefined;
  if (query.category) {
    const category = await getCategoryBySlug(db, store.id, query.category);
    if (!category) {
      throw new AppError(
        "NOT_FOUND",
        CATALOG_MESSAGES.categoryNotFound,
        undefined,
        CATALOG_REASONS.categoryNotFound,
      );
    }
    categoryId = category.id;
  }

  const { rows, total } = await listProductsPage(
    db,
    store.id,
    { q: query.q, categoryId, status: "active" },
    pageWindow(query.page, PAGE_SIZE.public),
  );

  const [images, categories] = await Promise.all([
    listImagesForProducts(
      db,
      store.id,
      rows.map((row) => row.id),
    ),
    listCategories(db, store.id),
  ]);
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));

  return {
    items: rows.map((row) => {
      const first = images.get(row.id)?.[0];
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        priceMinor: row.priceMinor,
        currency: currencyOf(store),
        categorySlug: row.categoryId ? (slugById.get(row.categoryId) ?? null) : null,
        sortOrder: row.sortOrder,
        image: first ? toMediaImage(env, first) : null,
      };
    }),
    page: query.page,
    pageSize: PAGE_SIZE.public,
    total,
    hasMore: query.page * PAGE_SIZE.public < total,
  };
}

export async function getPublicProduct(
  env: Env,
  db: Database,
  store: Store,
  productSlug: string,
): Promise<PublicProductDetail> {
  assertStoreReadable(store);

  const product = await getProductBySlug(db, store.id, productSlug, { onlyVisible: true });
  if (!product) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.productNotFound,
      undefined,
      CATALOG_REASONS.productNotFound,
    );
  }

  const [images, category] = await Promise.all([
    listProductImages(db, store.id, product.id),
    product.categoryId ? getCategoryById(db, store.id, product.categoryId) : Promise.resolve(null),
  ]);

  const currency = currencyOf(store);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceMinor: product.priceMinor,
    currency,
    category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    sortOrder: product.sortOrder,
    images: images.map((image) => toMediaImage(env, image)),
    whatsappUrl: buildWhatsappUrl({
      number: store.whatsappNumber,
      template: store.whatsappMessageTemplate,
      storeName: store.name,
      productName: product.name,
      priceLabel: priceLabel(product.priceMinor, currency),
    }),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** Sitemap: slugs y `updatedAt` de categorías y productos vivos (PLAN §8.2). */
export async function getPublicSitemap(
  db: Database,
  store: Store,
): Promise<{
  categories: { slug: string; updatedAt: string }[];
  products: { slug: string; updatedAt: string }[];
}> {
  assertStoreReadable(store);
  const [categories, products] = await Promise.all([
    listPublicCategoryEntries(db, store.id),
    listPublicProductEntries(db, store.id),
  ]);
  return {
    categories: categories.map((entry) => ({
      slug: entry.slug,
      updatedAt: entry.updatedAt.toISOString(),
    })),
    products: products.map((entry) => ({
      slug: entry.slug,
      updatedAt: entry.updatedAt.toISOString(),
    })),
  };
}
