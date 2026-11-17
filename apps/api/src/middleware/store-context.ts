/**
 * Accesores tipados del contexto que deja `requireStoreSession`.
 *
 * `storeId` sale **siempre** de esa sesión + la tienda resuelta en servidor
 * (PLAN §7.8 / P4). Ningún handler lo acepta del body ni del query.
 */
import type { Context } from "hono";

import type { Store } from "@tucatalogo/db";

import { AppError } from "../errors";
import type { AppEnv } from "../types";
import type { StoreOwner } from "../services/store";

export function sessionStore(c: Context<AppEnv>): Store {
  const store = c.get("store") as Store | undefined;
  if (!store) {
    throw new AppError("INTERNAL", "Contexto de tienda ausente.");
  }
  return store;
}

export function sessionOwner(c: Context<AppEnv>): StoreOwner {
  const owner = c.get("storeOwner");
  if (!owner) {
    throw new AppError("INTERNAL", "Contexto de dueño ausente.");
  }
  return owner;
}

export function sessionStoreId(c: Context<AppEnv>): string {
  const storeId = c.get("storeId");
  if (!storeId) {
    throw new AppError("INTERNAL", "Contexto de tienda ausente.");
  }
  return storeId;
}
