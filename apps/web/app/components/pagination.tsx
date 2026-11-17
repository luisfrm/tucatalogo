import { Button } from "@tucatalogo/ui";
import { Link } from "react-router";

import type { CatalogQuery } from "~/lib/urls";
import { pageHref, totalPages } from "~/lib/urls";

/** Paginación de 24 productos por página, conservando filtros y `siteId`. */
export function Pagination({
  page,
  pageSize,
  total,
  query,
  siteId,
}: {
  page: number;
  pageSize: number;
  total: number;
  query: Pick<CatalogQuery, "category" | "q">;
  siteId: string | null;
}) {
  const pages = totalPages(total, pageSize);
  if (pages <= 1) return null;

  const params = { ...query, siteId };
  const hasPrev = page > 1;
  const hasNext = page < pages;

  return (
    <nav aria-label="Paginación del catálogo" className="flex items-center justify-between gap-3">
      {hasPrev ? (
        <Button asChild variant="secondary" size="md">
          <Link to={pageHref(page - 1, params)} rel="prev">
            Anterior
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="secondary" size="md" disabled>
          Anterior
        </Button>
      )}

      <p className="text-sm text-text-muted" aria-live="polite">
        Página {page} de {pages}
      </p>

      {hasNext ? (
        <Button asChild variant="secondary" size="md">
          <Link to={pageHref(page + 1, params)} rel="next">
            Siguiente
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="secondary" size="md" disabled>
          Siguiente
        </Button>
      )}
    </nav>
  );
}
