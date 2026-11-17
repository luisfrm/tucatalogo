import { integer } from "drizzle-orm/sqlite-core";

/**
 * Timestamps del proyecto: `integer` epoch ms (PLAN §6.1).
 *
 * `mode: "timestamp_ms"` mantiene el valor en milisegundos en D1 y expone
 * `Date` en TypeScript, que es lo que espera Better Auth al leer y escribir
 * `created_at` / `updated_at` / `expires_at` en las tablas `*_sessions`,
 * `*_accounts`, `*_verifications` y `*_two_factor`.
 *
 * Sin `DEFAULT` en DDL: el valor lo asigna el service o Better Auth.
 */
export function timestamps() {
  return {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  };
}
