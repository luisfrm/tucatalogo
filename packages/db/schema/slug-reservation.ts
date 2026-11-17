import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Cuarentena temporal de un slug tras el hard delete de su tienda (PLAN §6.10).
 *
 * `store_id` **no** lleva FK: debe sobrevivir al borrado de la tienda y no
 * apunta a nada que exista. `reason` vale `deleted` en el MVP. La lista de
 * slugs reservados (`www`, `api`, ...) es una constante en `packages/shared`,
 * no filas de esta tabla.
 */
export const slugReservations = sqliteTable(
  "slug_reservation",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    /** Sin FK a propósito: la tienda ya no existe. */
    storeId: text("store_id"),
    reason: text("reason").notNull(),
    /** `now + 90 días`; el slug queda libre solo. */
    reservedUntil: integer("reserved_until", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("slug_reservation_slug_uq").on(table.slug),
    index("slug_reservation_reserved_until_idx").on(table.reservedUntil),
  ],
);
