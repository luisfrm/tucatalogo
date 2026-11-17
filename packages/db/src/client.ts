import { drizzle } from "drizzle-orm/d1";

import * as schema from "../schema/index";

/**
 * Único punto de creación del cliente D1. Solo lo usan los repositories
 * de `apps/api` (PLAN §4.1); los services nunca importan Drizzle.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
