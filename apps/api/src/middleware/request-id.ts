import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../types";

/**
 * Un `requestId` por request, generado por el servidor, devuelto al cliente y
 * en cada log (PLAN §8.7).
 *
 * El `requestId` **nunca** se toma de una cabecera: un cliente podría enviar
 * `x-request-id` o falsificar `cf-ray` y correlacionar/contaminar trazas
 * ajenas. `cf-ray` (si existe) se registra como dato aparte, no como id.
 *
 * No se registran cuerpos, cookies, tokens ni emails.
 */
export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = crypto.randomUUID();
  const cfRay = c.req.header("cf-ray") ?? null;

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  const startedAt = Date.now();
  await next();

  console.log(
    JSON.stringify({
      level: "info",
      requestId,
      ...(cfRay ? { cfRay } : {}),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    }),
  );
};
