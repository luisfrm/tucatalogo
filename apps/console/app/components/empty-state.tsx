import type { ReactNode } from "react";

/** Estado vacío explícito: nunca una tabla vacía sin explicación. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border-strong/60 bg-surface px-4 py-10 text-center">
      <p className="font-semibold text-text">{title}</p>
      {description ? <p className="max-w-md text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
