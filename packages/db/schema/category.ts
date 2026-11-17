import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./columns";
import { stores } from "./store";

/**
 * Categoría de una tienda (PLAN §6.6). `slug` es único **por tienda**.
 * Borrar la tienda borra sus categorías (cascade).
 */
export const categories = sqliteTable(
  "category",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("category_store_slug_uq").on(table.storeId, table.slug)],
);
