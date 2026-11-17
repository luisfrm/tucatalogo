/**
 * Rate limit de las operaciones de negocio (PLAN §7.7 / §8.8).
 *
 * Usa la **misma** infraestructura de contadores en D1 que auth
 * (`repositories/rate-limit.ts`): ventana fija, incremento atómico y `429` con
 * `Retry-After`. No hay Durable Objects.
 *
 * `assertRateLimit` de `services/rate-limit.ts` no se reutiliza porque su
 * parámetro `operation` está cerrado al union de `RATE_LIMITS`
 * (`constants/auth.ts`), que no se toca en este cambio.
 */
import type { Database } from "@tucatalogo/db";

import {
  CATALOG_MESSAGES,
  CATALOG_RATE_LIMITS,
  CATALOG_REASONS,
  type CatalogRateLimitOperation,
} from "../constants/catalog";
import { AppError } from "../errors";
import { incrementRateLimitCounter } from "../repositories/rate-limit";

/**
 * Consume un cupo y lanza `429` con `Retry-After` si se agotó.
 * El sujeto debe ser un identificador del servidor (p. ej. el id de tienda),
 * nunca un dato personal en claro.
 */
export async function assertCatalogRateLimit(
  db: Database,
  operation: CatalogRateLimitOperation,
  subject: string,
  now: Date = new Date(),
): Promise<void> {
  const rule = CATALOG_RATE_LIMITS[operation];
  const state = await incrementRateLimitCounter(
    db,
    `${operation}:${subject}`,
    rule.windowMs,
    now,
  );

  if (state.count <= rule.max) return;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((state.expiresAt.getTime() - now.getTime()) / 1000),
  );
  throw new AppError(
    "RATE_LIMITED",
    CATALOG_MESSAGES.rateLimited,
    undefined,
    CATALOG_REASONS.rateLimited,
    { "retry-after": String(retryAfterSeconds) },
  );
}
