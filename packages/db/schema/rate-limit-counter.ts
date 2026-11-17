import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Contadores de rate limit con estado duradero (PLAN §7.7 / §8.8).
 *
 * Ventana fija por `bucket`: la clave ya viene normalizada del service e
 * incluye operación + sujeto hasheado (`login:store:<emailHash>:<ipHash>`).
 * **Nunca** se guarda email ni IP en claro: solo hashes HMAC.
 *
 * El incremento es un `UPSERT` atómico en el repository; `expires_at` permite
 * purgar contadores viejos sin tocar los vigentes. No hay Durable Objects.
 */
export const rateLimitCounters = sqliteTable(
  "rate_limit_counter",
  {
    /** Clave del contador (`<operation>:<sujeto>`). */
    bucket: text("bucket").primaryKey(),
    /** Peticiones contadas en la ventana vigente. */
    count: integer("count").notNull(),
    /** Inicio de la ventana vigente (epoch ms). */
    windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
    /** Fin de la ventana vigente; pasado este instante el contador se reinicia. */
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("rate_limit_counter_expires_at_idx").on(table.expiresAt)],
);
