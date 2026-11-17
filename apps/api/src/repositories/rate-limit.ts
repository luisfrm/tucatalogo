/**
 * Repositorio de contadores de rate limit (PLAN §7.7 / §8.8).
 *
 * Ventana fija con `UPSERT` atómico y `RETURNING`: dos peticiones simultáneas
 * no pueden perder incrementos. Sin Durable Objects.
 */
import { eq, lt, sql } from "@tucatalogo/db";

import type { Database } from "@tucatalogo/db";
import { rateLimitCounters } from "@tucatalogo/db/schema";

export interface RateLimitCounterState {
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
}

/**
 * Incrementa el contador `bucket` y devuelve su estado.
 * Si la ventana anterior ya expiró, el contador se reinicia a 1.
 */
export async function incrementRateLimitCounter(
  db: Database,
  bucket: string,
  windowMs: number,
  now: Date,
): Promise<RateLimitCounterState> {
  const nowMs = now.getTime();
  const expiresAtMs = nowMs + windowMs;

  const rows = await db.all<{
    count: number;
    window_started_at: number;
    expires_at: number;
  }>(sql`
    INSERT INTO ${rateLimitCounters} (bucket, count, window_started_at, expires_at, updated_at)
    VALUES (${bucket}, 1, ${nowMs}, ${expiresAtMs}, ${nowMs})
    ON CONFLICT(bucket) DO UPDATE SET
      count = CASE WHEN ${rateLimitCounters.expiresAt} <= ${nowMs} THEN 1 ELSE ${rateLimitCounters.count} + 1 END,
      window_started_at = CASE WHEN ${rateLimitCounters.expiresAt} <= ${nowMs} THEN ${nowMs} ELSE ${rateLimitCounters.windowStartedAt} END,
      expires_at = CASE WHEN ${rateLimitCounters.expiresAt} <= ${nowMs} THEN ${expiresAtMs} ELSE ${rateLimitCounters.expiresAt} END,
      updated_at = ${nowMs}
    RETURNING count, window_started_at, expires_at
  `);

  const row = rows[0];
  return {
    count: row?.count ?? 1,
    windowStartedAt: new Date(row?.window_started_at ?? nowMs),
    expiresAt: new Date(row?.expires_at ?? expiresAtMs),
  };
}

/** Estado actual sin incrementar (diagnóstico y tests). */
export async function readRateLimitCounter(
  db: Database,
  bucket: string,
): Promise<RateLimitCounterState | null> {
  const rows = await db
    .select()
    .from(rateLimitCounters)
    .where(eq(rateLimitCounters.bucket, bucket))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { count: row.count, windowStartedAt: row.windowStartedAt, expiresAt: row.expiresAt };
}

/** Borra contadores caducados (best effort, lo llama el service). */
export async function pruneRateLimitCounters(db: Database, now: Date): Promise<void> {
  await db.delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, now));
}
