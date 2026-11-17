import type { AuditEntry } from "@tucatalogo/types";

/**
 * Presentación del audit log (PLAN §11.2 / §11.3).
 *
 * Se muestran los códigos tal cual cuando no hay etiqueta: nada de inventar
 * nombres ni de ocultar acciones nuevas de la API.
 */

const ACTION_LABELS: Record<string, string> = {
  "admin.init": "Alta inicial del admin",
  "store.suspend": "Tienda suspendida",
  "store.reactivate": "Tienda reactivada",
  "store.delete": "Tienda eliminada",
};

const ACTOR_LABELS: Record<AuditEntry["actorType"], string> = {
  admin: "Admin",
  owner: "Dueño",
  system: "Sistema",
};

export const AUDIT_ACTION_SUGGESTIONS = [
  "admin.init",
  "store.suspend",
  "store.reactivate",
  "store.delete",
] as const;

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatAuditActorType(actorType: AuditEntry["actorType"]): string {
  return ACTOR_LABELS[actorType];
}

/** Tienda destino de la entrada: slug si existe; si no, el id; si no, `—`. */
export function formatAuditTarget(entry: Pick<AuditEntry, "storeSlug" | "storeId">): string {
  if (entry.storeSlug) return entry.storeSlug;
  if (entry.storeId) return entry.storeId;
  return "—";
}

/**
 * Metadata compacta para la tabla. Se trunca para no romper la densidad; el
 * valor completo sigue disponible en el objeto original del API.
 */
export function summarizeMetadata(
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  const text = JSON.stringify(metadata);
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}
