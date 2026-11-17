import { z } from "zod";

/** Monedas admitidas en el MVP (PLAN §6.5). */
export const CURRENCIES = ["USD", "EUR", "COP", "VES", "ARS"] as const;

export const currencySchema = z.enum(CURRENCIES);

export type Currency = z.infer<typeof currencySchema>;

/** Estados de tienda. No existe `isActive` (D3). */
export const STORE_STATUSES = ["pending", "active", "suspended"] as const;
export const storeStatusSchema = z.enum(STORE_STATUSES);
export type StoreStatus = z.infer<typeof storeStatusSchema>;

export const SUSPENDED_BY = ["owner", "admin"] as const;
export const suspendedBySchema = z.enum(SUSPENDED_BY);
export type SuspendedBy = z.infer<typeof suspendedBySchema>;

/** El MVP solo admite claro como modo por defecto (PLAN §6.5 / §10.7). */
export const COLOR_MODES = ["light", "dark"] as const;
export const colorModeSchema = z.enum(COLOR_MODES);
export type ColorMode = z.infer<typeof colorModeSchema>;
