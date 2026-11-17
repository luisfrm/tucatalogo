import { Hono } from "hono";

import { APP_VERSION, type AppEnv } from "../types";

/**
 * GET / — información del worker. No es una ruta de negocio: el API no tiene
 * ruta pública y solo se consume por service binding.
 */
export const rootRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.json({
    name: "tucatalogo-api",
    version: APP_VERSION,
    environment: c.env.ENVIRONMENT ?? null,
    routes: [
      "/health",
      "/auth/store/*",
      "/auth/console/*",
      "/public/:slug/*",
      "/panel/*",
      "/console/*",
      "/media/*",
    ],
    note: "API interno. Consumo exclusivo por service binding (PLAN §4.4).",
  }),
);
