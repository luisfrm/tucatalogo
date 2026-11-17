import { Button, Input } from "@tucatalogo/ui";
import { Form, Link } from "react-router";

import { CategoryChip } from "./empty-state";
import type { CatalogQuery } from "~/lib/urls";
import { categoryHref, homeHref, storeHref } from "~/lib/urls";

/**
 * Filtro por categoría + búsqueda por nombre (PLAN §4.5 D).
 * Formulario GET: funciona sin JS y la URL es compartible. Los enlaces
 * conservan `?q=`, `?category=` y `?siteId=` (solo dev/local).
 */
export interface CatalogToolbarProps {
  categories: Array<{ slug: string; label: string }>;
  query: CatalogQuery;
  siteId: string | null;
}

export function CatalogToolbar({ categories, query, siteId }: CatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <Form
        method="get"
        action={storeHref("/", { siteId })}
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
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
              <Link to={homeHref({ siteId })}>Limpiar</Link>
            </Button>
          ) : null}
        </div>
      </Form>

      {categories.length > 0 ? (
        <nav aria-label="Filtrar por categoría">
          <ul className="flex flex-wrap gap-2">
            <li>
              <CategoryChip to={homeHref({ q: query.q, siteId })} active={query.category === null}>
                Todas
              </CategoryChip>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <CategoryChip
                  to={categoryHref(category.slug, { q: query.q, siteId })}
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
