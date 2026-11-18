import type { ReactNode } from "react";

/**
 * Estado vacío y estado de error comparten geometría (superficie `surface`,
 * borde suave, radio medio, sombra baja y mismo ritmo vertical): nunca aparece
 * una caja "huérfana" distinta según la pantalla.
 *
 * El título es Figtree: Fraunces queda para títulos de página.
 */
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
    <div className="grid justify-items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-5 py-10 text-center shadow-[var(--shadow-sm)]">
      <p className="text-base font-semibold text-text">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
