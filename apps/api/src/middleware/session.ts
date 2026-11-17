/**
 * Middlewares de sesión que consumen `@api-dev` (panel y console).
 *
 * Reglas (PLAN §7.2 / §7.8):
 * - `storeId` sale **siempre** del contexto resuelto en servidor (cabecera
 *   interna `x-store-slug`) + la sesión del reino. Nunca de `body`, `query`
 *   (`?siteId` se eliminó en B1) ni cabecera del navegador.
 * - La sesión de tienda debe pertenecer al dueño de esa tienda (`403` si no).
 * - La sesión de console exige 2FA **verificado**
 *   (`admin_two_factor.verified = 1`); una cookie de tienda no abre el console
 *   y viceversa (prefijos y secretos distintos).
 */
import type { MiddlewareHandler } from "hono";

import type { Database } from "@tucatalogo/db";
import { createDb } from "@tucatalogo/db";

import { getConsoleAuth, getStoreAuth } from "../auth";
import { asSessionUser, callAuthEndpoint, toAuthHeaders } from "../auth/shared";
import { AUTH_MESSAGES, AUTH_REASONS } from "../constants/auth";
import { AppError } from "../errors";
import { getClientIp } from "../libs/ip";
import { isTwoFactorVerified } from "../repositories/auth-console";
import { resolveStore } from "../services/auth-store";
import type { AppEnv } from "../types";

export function dbFor(c: { env: AppEnv["Bindings"] }): Database {
  return createDb(c.env.DB);
}

/**
 * Exige sesión válida del reino tienda y que el usuario sea dueño de la tienda
 * del host. Deja `store`, `storeId`, `storeSlug` y `storeOwner` en el contexto.
 */
export const requireStoreSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = dbFor(c);
  const { store, slug } = await resolveStore(db, c.req.raw.headers);

  const auth = getStoreAuth(c.env);
  const ip = getClientIp(c.req.raw.headers);

  const result = await callAuthEndpoint<unknown>(
    auth.api.getSession({ headers: toAuthHeaders(c.req.raw, ip), asResponse: true }),
  );
  const user = asSessionUser(result.data);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Inicia sesión para continuar.");
  }
  if (store.ownerId !== user.id) {
    throw new AppError("FORBIDDEN", AUTH_MESSAGES.storeMismatch, undefined, AUTH_REASONS.storeMismatch);
  }

  c.set("store", store);
  c.set("storeId", store.id);
  c.set("storeSlug", slug);
  c.set("storeOwner", { id: user.id, email: user.email, name: user.name });

  await next();
};

/**
 * Exige sesión del reino console **con 2FA verificado**. Una sesión a medio
 * enrolar (o una fila `admin_two_factor.verified = 0`) no pasa: solo puede
 * llamar a `/auth/console/2fa/*`.
 */
export const requireAdminSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = getConsoleAuth(c.env);
  const ip = getClientIp(c.req.raw.headers);

  const result = await callAuthEndpoint<unknown>(
    auth.api.getSession({ headers: toAuthHeaders(c.req.raw, ip), asResponse: true }),
  );
  const user = asSessionUser(result.data);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Inicia sesión para continuar.");
  }
  if (!user.twoFactorEnabled || !(await isTwoFactorVerified(dbFor(c), user.id))) {
    throw new AppError(
      "FORBIDDEN",
      AUTH_MESSAGES.twoFactorRequired,
      undefined,
      AUTH_REASONS.twoFactorRequired,
    );
  }

  c.set("adminId", user.id);
  c.set("adminUser", { id: user.id, email: user.email, name: user.name });

  await next();
};
