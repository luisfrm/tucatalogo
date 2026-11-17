/**
 * Servicio de auditoría (PLAN §6.11). Append-only.
 *
 * `metadata` es JSON acotado: motivo, resultado y contadores. Nunca PII
 * sensible, tokens, OTP ni IPs en claro.
 */
import type { Database } from "@tucatalogo/db";
import type { AuditEntry, ConsoleAuditList, ConsoleAuditQuery } from "@tucatalogo/types";

import { PAGE_SIZE } from "../constants/catalog";
import { pageWindow } from "../libs/pagination";
import { insertAuditEntry, listAuditEntries } from "../repositories/audit";

/** Origen de una entrada: mismo enum que `audit_log.actor_type` (PLAN §6.11). */
export type AuditActorType = "admin" | "owner" | "system";

export interface AuditRecord {
  actorType: AuditActorType;
  actorId: string | null;
  storeId: string | null;
  storeSlug: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

/** Escribe una entrada. El id y la fecha los pone el servidor. */
export async function recordAudit(db: Database, record: AuditRecord): Promise<void> {
  await insertAuditEntry(db, {
    id: crypto.randomUUID(),
    actorType: record.actorType,
    actorId: record.actorId,
    storeId: record.storeId,
    storeSlug: record.storeSlug,
    action: record.action,
    targetType: record.targetType ?? null,
    targetId: record.targetId ?? null,
    metadata: record.metadata ? JSON.stringify(record.metadata) : null,
    ipHash: record.ipHash ?? null,
    createdAt: new Date(),
  });
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Dato corrupto: se devuelve null y se conserva la entrada tal cual.
  }
  return null;
}

export async function listConsoleAudit(
  db: Database,
  query: ConsoleAuditQuery,
): Promise<ConsoleAuditList> {
  const { rows, total } = await listAuditEntries(
    db,
    { storeId: query.storeId, action: query.action },
    pageWindow(query.page, PAGE_SIZE.audit),
  );

  const items: AuditEntry[] = rows.map((row) => ({
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId,
    storeId: row.storeId,
    storeSlug: row.storeSlug,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    items,
    page: query.page,
    pageSize: PAGE_SIZE.audit,
    total,
    hasMore: query.page * PAGE_SIZE.audit < total,
  };
}
