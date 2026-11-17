import { Hono } from "hono";

import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { consoleAuthRoutes } from "./routes/auth-console";
import { storeAuthRoutes } from "./routes/auth-store";
import { consoleRoutes } from "./routes/console";
import { healthRoutes } from "./routes/health";
import { mediaRoutes } from "./routes/media";
import { panelRoutes } from "./routes/panel";
import { publicRoutes } from "./routes/public";
import { rootRoutes } from "./routes/root";
import type { AppEnv } from "./types";

/**
 * App completa del worker `api`. Todas las rutas se montan aquí (auth, panel,
 * público, console y media) para que `AppType` sea el contrato único que
 * consume `packages/api-client` por Hono RPC.
 *
 * La definición va encadenada a propósito: Hono RPC solo ve las rutas cuyo
 * schema forma parte del tipo del router.
 */
const routes = new Hono<AppEnv>()
  .use("*", requestIdMiddleware)
  .route("/", rootRoutes)
  .route("/health", healthRoutes)
  .route("/auth/store", storeAuthRoutes)
  .route("/auth/console", consoleAuthRoutes)
  .route("/public", publicRoutes)
  .route("/panel", panelRoutes)
  .route("/console", consoleRoutes)
  .route("/media", mediaRoutes);

routes.onError(errorHandler);
routes.notFound(notFoundHandler);

export const app = routes;

export type AppType = typeof app;
