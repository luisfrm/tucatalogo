import { buttonVariants } from "@tucatalogo/ui";
import { Link } from "react-router";

/** Paginación server-driven: enlaces que conservan búsqueda y filtros. */
export function Pagination({
  page,
  totalPages,
  buildHref,
  label = "Paginación",
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"
    >
      {hasPrevious ? (
        <Link to={buildHref(page - 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Anterior
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-xs text-text-muted">
        Página {page} de {totalPages}
      </span>
      {hasNext ? (
        <Link to={buildHref(page + 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Siguiente
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
