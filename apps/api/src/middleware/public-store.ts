/**
 * Contexto público (storefront): resuelve la tienda del `:slug` de la ruta y
 * deja solo tiendas `active`. Inexistente, suspendida o eliminada → el mismo
 * 404, sin revelar el motivo (PLAN §4.5 D / §12).
 */
import type { MiddlewareHandler } from "hono";

import type { Store } from "@tucatalogo/db";

import { CATALOG_MESSAGES } from "../constants/catalog";
import { AppError } from "../errors";
import { getActiveStore } from "../services/store";
import type { AppEnv } from "../types";
import { dbFor } from "./session";

export const requirePublicStore: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = c.req.param("slug");
  if (!slug) {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeUnavailable);
  }

  const store = await getActiveStore(dbFor(c), slug);
  c.set("store", store);
  c.set("storeId", store.id);
  c.set("storeSlug", store.slug);

  await next();
};

/** Tienda ya validada por `requirePublicStore`. */
export function publicStore(c: { get: (key: "store") => unknown }): Store {
  const store = c.get("store") as Store | undefined;
  if (!store) {
    throw new AppError("INTERNAL", "Contexto público ausente.");
  }
  return store;
}
