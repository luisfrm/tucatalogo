/**
 * Servicio de categorías (PLAN §6.6 / §8.2). `slug` único por tienda y el
 * borrado deja los productos con `category_id = NULL`.
 */
import type { Category, Database, Store } from "@tucatalogo/db";
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  PanelCategory,
  PanelCategoryList,
  PublicCategoryList,
} from "@tucatalogo/types";

import { CATALOG_MESSAGES, CATALOG_REASONS } from "../constants/catalog";
import { AppError } from "../errors";
import {
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  insertCategory,
  listCategories,
  listCategoryIds,
  listPublicCategories as listPublicCategoryRows,
  maxCategorySortOrder,
  reorderCategories,
  updateCategory as updateCategoryRow,
  type CategoryWithCount,
} from "../repositories/category";
import { assertStoreReadable } from "./store";

function toPanelCategory(category: CategoryWithCount): PanelCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    productCount: Number(category.productCount ?? 0),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function conflictSlug(): AppError {
  return new AppError(
    "CONFLICT",
    CATALOG_MESSAGES.categorySlugTaken,
    [{ path: "slug", message: CATALOG_MESSAGES.categorySlugTaken }],
    CATALOG_REASONS.categorySlugTaken,
  );
}

async function assertSlugAvailable(
  db: Database,
  storeId: string,
  slug: string,
  ignoreCategoryId?: string,
): Promise<void> {
  const existing = await getCategoryBySlug(db, storeId, slug);
  if (existing && existing.id !== ignoreCategoryId) throw conflictSlug();
}

async function withCount(db: Database, storeId: string, category: Category): Promise<PanelCategory> {
  const all = await listCategories(db, storeId);
  const found = all.find((item) => item.id === category.id);
  return toPanelCategory(
    found ?? { ...category, productCount: 0 },
  );
}

export async function listPanelCategories(
  db: Database,
  storeId: string,
): Promise<PanelCategoryList> {
  const rows = await listCategories(db, storeId);
  return { items: rows.map(toPanelCategory) };
}

export async function createCategory(
  db: Database,
  store: Store,
  input: CategoryCreateInput,
): Promise<PanelCategory> {
  await assertSlugAvailable(db, store.id, input.slug);

  const sortOrder = input.sortOrder ?? (await maxCategorySortOrder(db, store.id)) + 1;
  let category: Category;
  try {
    category = await insertCategory(db, {
      id: crypto.randomUUID(),
      storeId: store.id,
      name: input.name,
      slug: input.slug,
      sortOrder,
      now: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("category_store_slug_uq") || message.includes("category.slug")) {
      throw conflictSlug();
    }
    throw error;
  }

  return withCount(db, store.id, category);
}

export async function updatePanelCategory(
  db: Database,
  store: Store,
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<PanelCategory> {
  const existing = await getCategoryById(db, store.id, categoryId);
  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.categoryNotFound,
      undefined,
      CATALOG_REASONS.categoryNotFound,
    );
  }

  if (input.slug !== undefined) {
    await assertSlugAvailable(db, store.id, input.slug, categoryId);
  }

  let updated: Category | null;
  try {
    updated = await updateCategoryRow(
      db,
      store.id,
      categoryId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      new Date(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("category_store_slug_uq") || message.includes("category.slug")) {
      throw conflictSlug();
    }
    throw error;
  }

  if (!updated) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.categoryNotFound,
      undefined,
      CATALOG_REASONS.categoryNotFound,
    );
  }

  return withCount(db, store.id, updated);
}

export async function deletePanelCategory(
  db: Database,
  storeId: string,
  categoryId: string,
): Promise<void> {
  const deleted = await deleteCategory(db, storeId, categoryId, new Date());
  if (!deleted) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.categoryNotFound,
      undefined,
      CATALOG_REASONS.categoryNotFound,
    );
  }
}

/** Reorder all categories of a store; rejects partial or foreign ID lists. */
export async function reorderStoreCategories(
  db: Database,
  storeId: string,
  ids: readonly string[],
): Promise<void> {
  const existing = new Set(await listCategoryIds(db, storeId));
  const requested = new Set(ids);
  if (existing.size !== requested.size || [...requested].some((id) => !existing.has(id))) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.reorderMismatch,
      [{ path: "ids", message: CATALOG_MESSAGES.reorderMismatch }],
      CATALOG_REASONS.reorderMismatch,
    );
  }
  await reorderCategories(db, storeId, ids, new Date());
}

/** Public categories for storefront navigation and filter chips. */
export async function listPublicCategories(
  db: Database,
  store: Store,
): Promise<PublicCategoryList> {
  assertStoreReadable(store);
  const rows = await listPublicCategoryRows(db, store.id);
  return {
    items: rows.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      productCount: Number(category.productCount ?? 0),
    })),
  };
}
