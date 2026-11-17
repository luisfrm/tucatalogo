/**
 * Console (PLAN §8.2 / §11). Sesión del reino `admin` con 2FA completado;
 * una cookie de tienda no abre ninguna de estas rutas.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import {
  consoleAuditListSchema,
  consoleAuditQuerySchema,
  consoleDeleteStoreSchema,
  consoleStoreDetailSchema,
  consoleStoreListSchema,
  consoleStoresQuerySchema,
  consoleSuspendStoreSchema,
  resourceIdSchema,
} from "@tucatalogo/types";

import { AppError } from "../errors";
import { parseJsonBody, parseParams, parseQuery } from "../libs/validate";
import { dbFor, requireAdminSession } from "../middleware/session";
import { listConsoleAudit } from "../services/audit";
import {
  deleteStoreByAdmin,
  getConsoleStoreDetail,
  listConsoleStorePage,
  reactivateStoreByAdmin,
  suspendStoreByAdmin,
  type ConsoleActor,
} from "../services/console";
import type { AppEnv } from "../types";

const storeParams = z.object({ id: resourceIdSchema });

function actor(c: Context<AppEnv>): ConsoleActor {
  const admin = c.get("adminUser");
  const adminId = c.get("adminId");
  if (!admin || !adminId) {
    throw new AppError("INTERNAL", "Contexto de admin ausente.");
  }
  return { id: admin.id, email: admin.email };
}

export const consoleRoutes = new Hono<AppEnv>()
  .use("*", requireAdminSession)
  /** GET /console/stores?q=&status=&page= */
  .get("/stores", async (c) => {
    const query = parseQuery(c, consoleStoresQuerySchema);
    const list = await listConsoleStorePage(dbFor(c), query);
    return c.json(consoleStoreListSchema.parse(list));
  })
  /** GET /console/stores/:id — metadatos y conteos, sin contenido editable. */
  .get("/stores/:id", async (c) => {
    const { id } = parseParams(c, storeParams);
    const detail = await getConsoleStoreDetail(dbFor(c), id);
    return c.json(consoleStoreDetailSchema.parse(detail));
  })
  /** POST /console/stores/:id/suspend — motivo obligatorio + audit. */
  .post("/stores/:id/suspend", async (c) => {
    const { id } = parseParams(c, storeParams);
    const input = await parseJsonBody(c, consoleSuspendStoreSchema);
    const detail = await suspendStoreByAdmin(dbFor(c), id, input.reason, actor(c));
    return c.json(consoleStoreDetailSchema.parse(detail));
  })
  /** POST /console/stores/:id/reactivate — el console reactiva siempre. */
  .post("/stores/:id/reactivate", async (c) => {
    const { id } = parseParams(c, storeParams);
    const detail = await reactivateStoreByAdmin(dbFor(c), id, actor(c));
    return c.json(consoleStoreDetailSchema.parse(detail));
  })
  /** DELETE /console/stores/:id — `{confirmSlug}` + hard delete + audit. */
  .delete("/stores/:id", async (c) => {
    const { id } = parseParams(c, storeParams);
    const input = await parseJsonBody(c, consoleDeleteStoreSchema);
    await deleteStoreByAdmin(c.env, dbFor(c), id, input.confirmSlug, actor(c));
    return c.body(null, 204);
  })
  /** GET /console/audit?storeId=&action=&page= — solo lectura. */
  .get("/audit", async (c) => {
    const query = parseQuery(c, consoleAuditQuerySchema);
    const list = await listConsoleAudit(dbFor(c), query);
    return c.json(consoleAuditListSchema.parse(list));
  });
