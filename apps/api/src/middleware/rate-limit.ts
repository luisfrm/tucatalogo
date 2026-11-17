/**
 * Rate limits aplicados en el **route** (PLAN §8.8): antes de tocar el service.
 * Un exceso responde `429` + `Retry-After` con el envelope del proyecto.
 */
import type { MiddlewareHandler } from "hono";

import type { Database } from "@tucatalogo/db";

import type { RateLimitOperation } from "../constants/auth";
import { assertRateLimit } from "../services/rate-limit";
import type { AppEnv } from "../types";
import type { Context } from "hono";

/**
 * Middleware reutilizable para rutas con sujeto calculable de antemano
 * (`?slug`, IP, etc.). Los routes que necesitan hashear primero llaman a
 * `assertRateLimit` directamente.
 */
export function rateLimitMiddleware(
  db: Database,
  operation: RateLimitOperation,
  subject: (c: Context<AppEnv>) => string,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await assertRateLimit(db, operation, subject(c));
    await next();
  };
}
