/**
 * Rutas **solo de desarrollo**: outbox de email en memoria.
 *
 * Existen únicamente con `ENVIRONMENT=local` **y** `EMAIL_DRIVER=memory`; en
 * dev/prod responden 404 con el envelope normal (no hay bypass por cabecera ni
 * por query). Se montan fuera del contrato tipado (`AppType`) a propósito: son
 * una ayuda de desarrollo, no una superficie del API.
 *
 * No llevan autenticación porque solo son alcanzables en el `wrangler dev`
 * local (`127.0.0.1:9797`), donde el riesgo es el propio equipo. La respuesta
 * nunca se cachea y el contenido sale del ring buffer en memoria del isolate:
 * no se escribe en logs ni en D1.
 */
import { Hono } from "hono";

import { AppError } from "../errors";
import { findDevOutboxEntry, isDevOutboxEnabled, lastDevOutboxEntry } from "../libs/email";
import type { AppEnv } from "../types";

export const devRoutes = new Hono<AppEnv>();

devRoutes.use("*", async (c, next) => {
  // `no-store` también en los 404: una respuesta cacheada no debe sobrevivir a
  // un cambio de modo del worker.
  c.header("cache-control", "no-store");
  if (!isDevOutboxEnabled(c.env)) {
    return c.notFound();
  }
  await next();
});

/** GET /dev/outbox/last — último correo emitido (flujo de console). */
devRoutes.get("/outbox/last", (c) => {
  const entry = lastDevOutboxEntry();
  if (!entry) {
    throw new AppError("NOT_FOUND", "El outbox está vacío.");
  }
  return c.json(entry);
});

/** GET /dev/outbox?to=<email> — último correo de ese destinatario. */
devRoutes.get("/outbox", (c) => {
  const to = c.req.query("to")?.trim();
  if (!to) {
    throw new AppError("VALIDATION_ERROR", "Falta el parámetro `to`.", [
      { path: "to", message: "Indica el email del destinatario" },
    ]);
  }

  const entry = findDevOutboxEntry(to);
  if (!entry) {
    throw new AppError("NOT_FOUND", "No hay correos para ese destinatario.");
  }

  return c.json(entry);
});
