/**
 * Repositorio del `audit_log` (PLAN §6.11). Append-only: solo `insert` y
 * `select`; no existe update ni delete, ni siquiera para el console.
 */
import { and, desc, eq, sql } from "@tucatalogo/db";

import type { AuditLog, Database } from "@tucatalogo/db";
import { auditLogs, type ActorType } from "@tucatalogo/db/schema";

export interface NewAuditEntry {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  storeId: string | null;
  storeSlug: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  /** JSON acotado: motivo, resultado y contadores. Nunca PII ni tokens. */
  metadata?: string | null;
  ipHash?: string | null;
  createdAt: Date;
}

export async function insertAuditEntry(db: Database, entry: NewAuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    id: entry.id,
    actorType: entry.actorType,
    actorId: entry.actorId,
    storeId: entry.storeId,
    storeSlug: entry.storeSlug,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ipHash: entry.ipHash ?? null,
    createdAt: entry.createdAt,
  });
}

export interface AuditFilters {
  storeId?: string;
  action?: string;
}

export interface AuditPage {
  rows: AuditLog[];
  total: number;
}

export async function listAuditEntries(
  db: Database,
  filters: AuditFilters,
  pagination: { limit: number; offset: number },
): Promise<AuditPage> {
  const conditions = [];
  if (filters.storeId) conditions.push(eq(auditLogs.storeId, filters.storeId));
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ total: sql<number>`count(*)` }).from(auditLogs).where(where),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}
