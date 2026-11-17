/**
 * Enumeraciones que la base de datos acota con `CHECK`.
 *
 * Espejo de `packages/types/src/store.ts` (PLAN §6.5): `packages/db` no puede
 * importar `@tucatalogo/types` sin declararlo como dependencia de workspace, así
 * que los valores se repiten aquí. Si cambia uno, cambian los dos y hay que
 * regenerar la migración: `test/structure.test.ts` verifica los `CHECK` del SQL.
 */

/** Estados de tienda. No existe `isActive` (PLAN D3). */
export const STORE_STATUSES = ["pending", "active", "suspended"] as const;

/** Quién ejecutó la suspensión (PLAN §6.5). */
export const SUSPENDED_BY_VALUES = ["owner", "admin"] as const;

/** Monedas del MVP, en unidad mínima (PLAN §6.5 / AGENTS §14). */
export const CURRENCIES = ["USD", "EUR", "COP", "VES", "ARS"] as const;

/** Modo de color por defecto de la tienda (PLAN §6.5 / §10.7). */
export const COLOR_MODES = ["light", "dark"] as const;

/** Origen de una entrada de `audit_log` (PLAN §6.11). */
export const ACTOR_TYPES = ["admin", "owner", "system"] as const;

export type StoreStatus = (typeof STORE_STATUSES)[number];
export type SuspendedBy = (typeof SUSPENDED_BY_VALUES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
