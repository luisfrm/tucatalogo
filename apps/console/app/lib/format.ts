import type { StoreStatus, SuspendedBy } from "@tucatalogo/types";

/**
 * Formato de presentación del console (PLAN §11.2).
 *
 * Helpers puros: no tocan red, env ni React. Las fechas se formatean siempre en
 * UTC con locale `es-ES` para que el mismo dato produzca el mismo texto en
 * servidor, cliente y tests.
 */

export type StatusTone = "success" | "warning" | "danger";

const STORE_STATUS_LABELS: Record<StoreStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  active: { label: "Activa", tone: "success" },
  suspended: { label: "Suspendida", tone: "danger" },
};

export function describeStoreStatus(status: StoreStatus): { label: string; tone: StatusTone } {
  return STORE_STATUS_LABELS[status];
}

export function describeSuspendedBy(suspendedBy: SuspendedBy | null): string {
  if (suspendedBy === "owner") return "el dueño";
  if (suspendedBy === "admin") return "el equipo de TuCatálogo";
  return "—";
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const COUNT_FORMATTER = new Intl.NumberFormat("es-ES");

function parseIso(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-11-17T10:05:00.000Z` → `17 nov 2026`. Valor no parseable → `—`. */
export function formatDate(iso: string): string {
  const date = parseIso(iso);
  return date ? DATE_FORMATTER.format(date) : "—";
}

/** `2026-11-17T10:05:00.000Z` → `17 nov 2026, 10:05 UTC`. */
export function formatDateTime(iso: string): string {
  const date = parseIso(iso);
  return date ? `${DATE_TIME_FORMATTER.format(date)} UTC` : "—";
}

/** `2026-11-17T10:05:00.000Z` → `10:05` (UTC). */
export function formatTime(iso: string): string {
  const date = parseIso(iso);
  return date ? TIME_FORMATTER.format(date) : "—";
}

export function formatCount(value: number): string {
  return COUNT_FORMATTER.format(value);
}

export interface DayGroup<T> {
  /** Clave estable `YYYY-MM-DD` (o `sin-fecha`). */
  key: string;
  /** Etiqueta legible del día. */
  label: string;
  items: T[];
}

/**
 * Agrupa elementos por día conservando el orden de entrada. Se usa en el audit
 * log para separar las entradas por fecha sin reordenarlas.
 */
export function groupByDay<T>(
  items: readonly T[],
  getIso: (item: T) => string,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const byKey = new Map<string, DayGroup<T>>();

  for (const item of items) {
    const iso = getIso(item);
    const date = parseIso(iso);
    const key = date ? date.toISOString().slice(0, 10) : "sin-fecha";
    const label = date ? formatDate(iso) : "Sin fecha";

    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    const group: DayGroup<T> = { key, label, items: [item] };
    byKey.set(key, group);
    groups.push(group);
  }

  return groups;
}
