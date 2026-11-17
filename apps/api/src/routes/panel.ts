/**
 * Panel del dueño (PLAN §8.2). Todas las rutas exigen sesión del reino tienda
 * y que el usuario sea dueño de la tienda del `Host` (`requireStoreSession`).
 */
import { Hono } from "hono";

import { requireStoreSession } from "../middleware/session";
import type { AppEnv } from "../types";
import { panelCategoriesRoutes } from "./panel-categories";
import { panelHeroRoutes } from "./panel-hero";
import { panelProductsRoutes } from "./panel-products";
import { panelStoreRoutes } from "./panel-store";

export const panelRoutes = new Hono<AppEnv>()
  .use("*", requireStoreSession)
  .route("/store", panelStoreRoutes)
  .route("/products", panelProductsRoutes)
  .route("/categories", panelCategoriesRoutes)
  .route("/hero", panelHeroRoutes);
