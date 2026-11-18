import type { StoreStatus } from "@tucatalogo/types";

import { describeStoreStatus, type StatusTone } from "../lib/format";

/**
 * Tonos del badge tomados de los tokens de estado (`success`, `warning`,
 * `danger`). El borde y el punto refuerzan el texto: el estado nunca depende
 * solo del color. Se usa una píldora calma (10% de tinte) para que una tabla
 * de 50 tiendas no se llene de bloques de color.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-success/40 bg-success/8 text-success",
  warning: "border-warning/40 bg-warning/8 text-warning",
  danger: "border-danger/40 bg-danger/8 text-danger",
};

/** Badge de estado de tienda; texto + color (nunca solo color, PLAN §10). */
export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const { label, tone } = describeStoreStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-full)] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function CodeBadge({ children }: { children: string }) {
  return (
    <code className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
      {children}
    </code>
  );
}
