import { Button, Input } from "@tucatalogo/ui";
import { Form, Link } from "react-router";

import { CategoryChip } from "./empty-state";
import type { CatalogQuery } from "~/lib/urls";
import { categoryHref, homeHref, productsHref, storeHref } from "~/lib/urls";

/**
 * Category filter + name search toolbar.
 * Uses GET form so URLs are shareable and work without JS.
 */
export interface CatalogToolbarProps {
  categories: Array<{ slug: string; label: string }>;
  query: CatalogQuery;
  siteId: string | null;
  basePath?: "/" | "/productos";
  sort?: string | null;
}

export function CatalogToolbar({
  categories,
  query,
  siteId,
  basePath = "/",
  sort = null,
}: CatalogToolbarProps) {
  const buildHref = (opts: { category?: string | null; q?: string | null }) =>
    basePath === "/productos"
      ? productsHref({ category: opts.category ?? null, q: opts.q ?? null, sort, siteId })
      : opts.category
        ? categoryHref(opts.category, { q: opts.q ?? null, siteId })
        : homeHref({ q: opts.q ?? null, siteId });

  return (
    <div className="flex flex-col gap-4">
      <Form
        method="get"
        action={storeHref(basePath, { siteId })}
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
        <label htmlFor="catalogo-busqueda" className="sr-only">
          Buscar productos por nombre
        </label>
        <Input
          id="catalogo-busqueda"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder="Buscar productos"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={80}
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            Buscar
          </Button>
          {query.q || query.category ? (
            <Button asChild variant="ghost" size="md">
              <Link to={buildHref({})}>Limpiar</Link>
            </Button>
          ) : null}
        </div>
      </Form>

      {categories.length > 0 ? (
        <nav aria-label="Filtrar por categoría">
          <ul className="flex flex-wrap gap-2">
            <li>
              <CategoryChip to={buildHref({ q: query.q })} active={query.category === null}>
                Todas
              </CategoryChip>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <CategoryChip
                  to={buildHref({ category: category.slug, q: query.q })}
                  active={query.category === category.slug}
                >
                  {category.label}
                </CategoryChip>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
