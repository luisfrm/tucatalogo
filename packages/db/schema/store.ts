import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { storeUsers } from "./auth-store";
import { timestamps } from "./columns";
import { COLOR_MODES, CURRENCIES, STORE_STATUSES, SUSPENDED_BY_VALUES } from "./enums";

/**
 * Tienda (PLAN §6.5). Una cuenta = una tienda: `owner_id` es único.
 *
 * El estado vive **solo** en `status` (sin `isActive`, decisión D3). El MVP
 * crea la tienda `active`; `pending` se conserva en el enum pero ningún flujo
 * lo produce. Sin `DEFAULT` en `status`, `theme_id`, `primary_color`,
 * `color_mode_default`, `currency` ni `plan`: los asigna el service (PLAN §6.1).
 *
 * `plan`: `text NOT NULL` sin `DEFAULT` en DDL (PLAN §6.5). El service asigna
 * `free` en el MVP y los valores admitidos se fijan en F2 (Stripe/tiers).
 */
export const stores = sqliteTable(
  "store",
  {
    id: text("id").primaryKey(),
    /** FK a `store_users`; único (una cuenta = una tienda). */
    ownerId: text("owner_id")
      .notNull()
      .references(() => storeUsers.id),
    /** Único; formato `[a-z0-9-]`, sin reservados ni cuarentena activa. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: STORE_STATUSES }).notNull(),
    suspendedBy: text("suspended_by", { enum: SUSPENDED_BY_VALUES }),
    /** Obligatorio cuando `suspended_by = 'admin'` (regla del service). */
    suspendedReason: text("suspended_reason"),
    suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
    /** Debe existir en `packages/themes`; validado al escribir. */
    themeId: text("theme_id").notNull(),
    /** Hex `#RRGGBB`; validado (y ajustado a AA) al escribir. */
    primaryColor: text("primary_color").notNull(),
    colorModeDefault: text("color_mode_default", { enum: COLOR_MODES }).notNull(),
    currency: text("currency", { enum: CURRENCIES }).notNull(),
    /** Plan del baseline v1.0; el service asigna el valor de F2. */
    plan: text("plan").notNull(),
    /** E.164 sin `+`; si es null el botón de WhatsApp no se muestra. */
    whatsappNumber: text("whatsapp_number"),
    /** Variables `{producto}`, `{precio}`, `{tienda}`. */
    whatsappMessageTemplate: text("whatsapp_message_template"),
    /** **Key** de R2, no URL. */
    logoKey: text("logo_key"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("store_slug_uq").on(table.slug),
    uniqueIndex("store_owner_id_uq").on(table.ownerId),
    check(
      "store_status_ck",
      sql`${table.status} in ('pending','active','suspended')`,
    ),
    check(
      "store_suspended_by_ck",
      sql`${table.suspendedBy} is null or ${table.suspendedBy} in ('owner','admin')`,
    ),
    // Coherencia de suspensión: `status = 'suspended'` ⇔ `suspended_by IS NOT NULL`.
    check(
      "store_suspension_consistency_ck",
      sql`(${table.status} = 'suspended') = (${table.suspendedBy} is not null)`,
    ),
    check(
      "store_currency_ck",
      sql`${table.currency} in ('USD','EUR','COP','VES','ARS')`,
    ),
    check(
      "store_color_mode_default_ck",
      sql`${table.colorModeDefault} in ('light','dark')`,
    ),
  ],
);
