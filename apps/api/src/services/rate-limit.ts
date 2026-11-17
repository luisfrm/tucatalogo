/**
 * Rate limits en D1 (PLAN §7.7 / §8.8).
 *
 * Ventana fija por `bucket`. El sujeto (email/IP/sesión) llega **hasheado**:
 * el repositorio nunca ve datos personales en claro. Un exceso devuelve
 * `429` con `Retry-After` y sin revelar si el email o la tienda existen.
 */
import type { Database } from "@tucatalogo/db";

import { AUTH_MESSAGES, RATE_LIMITS, type RateLimitOperation } from "../constants/auth";
import { AppError } from "../errors";
import {
  incrementRateLimitCounter,
  pruneRateLimitCounters,
} from "../repositories/rate-limit";

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  limit: number;
  /** Segundos hasta que la ventana se reinicie (mínimo 1). */
  retryAfterSeconds: number;
}

/** Probabilidad de purgar contadores caducados en cada incremento (1/64). */
const PRUNE_CHANCE = 1 / 64;

export async function consumeRateLimit(
  db: Database,
  operation: RateLimitOperation,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const rule = RATE_LIMITS[operation];
  const bucket = `${operation}:${subject}`;
  const state = await incrementRateLimitCounter(db, bucket, rule.windowMs, now);

  if (Math.random() < PRUNE_CHANCE) {
    await pruneRateLimitCounters(db, new Date(now.getTime() - rule.windowMs)).catch(() => {
      // La purga es mantenimiento: si falla no debe tumbar la petición.
    });
  }

  const remainingMs = state.expiresAt.getTime() - now.getTime();
  return {
    allowed: state.count <= rule.max,
    count: state.count,
    limit: rule.max,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}

/**
 * Consume un cupo y lanza `429` con `Retry-After` si se agotó.
 * Lo llaman los routes (antes del service) y los services que ya tienen el
 * sujeto hasheado; nunca revela si el email o la tienda existen.
 */
export async function assertRateLimit(
  db: Database,
  operation: RateLimitOperation,
  subject: string,
  now: Date = new Date(),
): Promise<void> {
  const decision = await consumeRateLimit(db, operation, subject, now);
  if (decision.allowed) return;
  throw new AppError("RATE_LIMITED", AUTH_MESSAGES.rateLimited, undefined, undefined, {
    "retry-after": String(decision.retryAfterSeconds),
  });
}
