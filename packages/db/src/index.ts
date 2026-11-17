export { createDb } from "./client";
export type { Database } from "./client";
export * from "./queries";
export * from "./types";
export * as schema from "../schema/index";

/**
 * Operadores de `drizzle-orm` re-exportados para los repositories de
 * `apps/api`: así hay una sola copia de los tipos de Drizzle en el monorepo
 * (la que resuelve `packages/db`, que es la dueña del esquema).
 */
export { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
