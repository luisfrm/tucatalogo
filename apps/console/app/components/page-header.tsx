import type { ReactNode } from "react";

/**
 * Cabecera de página del console: listado, ficha y auditoría comparten la
 * misma jerarquía —eyebrow en versalitas, `h1` en Fraunces y una línea de
 * resumen— para que las tres pantallas se lean como el mismo producto.
 *
 * La separación con el contenido es una línea `border`, no una caja: el
 * contenido (tablas, paneles) es lo que lleva superficie.
 */
export function PageHeader({
  eyebrow = "Console",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border pb-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-0.5 truncate font-heading text-2xl font-semibold tracking-tight text-text">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 text-sm text-text-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
