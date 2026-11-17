import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { ACTOR_TYPES } from "./enums";

/**
 * Registro de auditoría append-only (PLAN §6.11).
 *
 * `store_id` y `store_slug` **no** llevan FK: la entrada sobrevive al borrado
 * de la tienda. `metadata` es JSON acotado (motivo, resultado, contadores), sin
 * PII sensible, sin tokens y sin OTP. No existe endpoint de update ni delete:
 * la inmutabilidad la garantiza el repository.
 */
export const auditLogs = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type", { enum: ACTOR_TYPES }).notNull(),
    /** Id del admin o del dueño; null cuando el actor es `system`. */
    actorId: text("actor_id"),
    /** Sin FK: el log sobrevive al borrado. */
    storeId: text("store_id"),
    /** Snapshot legible del slug. */
    storeSlug: text("store_slug"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** JSON acotado; nunca secretos, OTP ni tokens. */
    metadata: text("metadata"),
    /** Hash, no IP. */
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("audit_log_store_created_idx").on(table.storeId, sql`${table.createdAt} desc`),
    index("audit_log_actor_created_idx").on(table.actorId, sql`${table.createdAt} desc`),
    index("audit_log_action_created_idx").on(table.action, sql`${table.createdAt} desc`),
    check("audit_log_actor_type_ck", sql`${table.actorType} in ('admin','owner','system')`),
  ],
);
