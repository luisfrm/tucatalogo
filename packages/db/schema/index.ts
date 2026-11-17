/**
 * Esquema Drizzle de TuCatálogo (PLAN §6).
 *
 * Dos reinos de auth separados (`admin_*` console, `store_*` tienda) y las
 * tablas de negocio de la Fase 1. Un fichero por dominio; este índice es el
 * único punto de importación para `drizzle.config.ts` y `createDb`.
 *
 * Reglas fijas: `snake_case`, ids `text`, timestamps `integer` epoch ms,
 * booleanos `integer` 0/1 y dinero `integer` en unidad mínima. Sin `DEFAULT` en
 * columnas de estado o configuración: lo asigna el service (P1).
 */
export * from "./auth-console";
export * from "./auth-store";
export * from "./category";
export * from "./columns";
export * from "./enums";
export * from "./hero-slide";
export * from "./product";
export * from "./product-image";
export * from "./rate-limit-counter";
export * from "./signup-intent";
export * from "./slug-reservation";
export * from "./store";
export * from "./audit-log";
