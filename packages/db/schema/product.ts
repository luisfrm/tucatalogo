import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { categories } from "./category";
import { timestamps } from "./columns";
import { stores } from "./store";

/**
 * Producto de una tienda (PLAN §6.7).
 *
 * - Sin `currency`: se hereda de `store` (precios en unidad mínima).
 * - `category_id` es `on delete set null`: borrar una categoría no borra productos.
 * - Unicidad de `slug` **parcial** por tienda: `WHERE is_deleted = 0`, para que
 *   un producto con borrado lógico libere su slug.
 */
export const products = sqliteTable(
  "product",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Unidad mínima de la moneda de la tienda; entero ≥ 0. */
    priceMinor: integer("price_minor").notNull(),
    /** 0/1: ocultar sin borrar. */
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    /** 0/1: borrado lógico. */
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("product_store_listing_idx").on(
      table.storeId,
      table.isDeleted,
      table.isActive,
      table.sortOrder,
    ),
    index("product_store_category_idx").on(table.storeId, table.categoryId),
    uniqueIndex("product_store_slug_uq")
      .on(table.storeId, table.slug)
      .where(sql`${table.isDeleted} = 0`),
    check("product_price_minor_ck", sql`${table.priceMinor} >= 0`),
  ],
);
