import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./columns";
import { stores } from "./store";

/**
 * Slide del hero de la tienda (PLAN §6.9).
 *
 * `image_desktop_key` / `image_mobile_key` son **bases** de R2; el móvil es un
 * recorte distinto, no la misma imagen escalada. El tope de 10 slides y la
 * validación de `cta_url` (https o ruta relativa) son reglas del service.
 */
export const heroSlides = sqliteTable(
  "hero_slide",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    imageDesktopKey: text("image_desktop_key").notNull(),
    imageMobileKey: text("image_mobile_key").notNull(),
    title: text("title"),
    subtitle: text("subtitle"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    sortOrder: integer("sort_order").notNull(),
    /** 0/1. */
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    ...timestamps(),
  },
  (table) => [index("hero_slide_store_active_sort_idx").on(table.storeId, table.isActive, table.sortOrder)],
);
