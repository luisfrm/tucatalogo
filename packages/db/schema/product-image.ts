import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { products } from "./product";

/**
 * Imagen de producto (PLAN §6.8).
 *
 * `r2_key` es la **base** del objeto: el full y el thumb se derivan con los
 * sufijos `-full.webp` y `-thumb.webp` (PLAN §6.8.1). `alt` es obligatorio.
 * Solo `created_at`: PLAN §6.8 no define `updated_at` para la imagen; el orden
 * del carrusel se persiste en `sort_order` y lo reescribe el service junto con
 * el resto del orden.
 */
export const productImages = sqliteTable(
  "product_image",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    alt: text("alt").notNull(),
    /** Del full normalizado (máx. 1600 px de ancho). */
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("product_image_product_sort_idx").on(table.productId, table.sortOrder)],
);
