import { listPublicCategories, listPublicProducts } from "@tucatalogo/api-client";
import type { PublicProductList } from "@tucatalogo/types";
import { Button, Select } from "@tucatalogo/ui";
import { Form, Link, useRouteLoaderData } from "react-router";

import type { Route } from "./+types/products";

import { CatalogToolbar } from "~/components/catalog-toolbar";
import { EmptyState } from "~/components/empty-state";
import { ProductCard } from "~/components/product-card";
import { formatStorePrice } from "~/lib/price";
import { isCategoryNotFound, resolveStoreQuery, throwApiFailure } from "~/lib/runtime.server";
import { seoDescriptors } from "~/lib/seo";
import type { RootData } from "~/lib/store-context";
import { productsHref, readCatalogQuery, totalPages } from "~/lib/urls";

const PUBLIC_PAGE_SIZE = 24;

type SortOption = "default" | "price-asc" | "price-desc";

function readSort(url: URL): SortOption {
  const raw = url.searchParams.get("sort");
  if (raw === "price-asc" || raw === "price-desc") return raw;
  return "default";
}

const EMPTY_PRODUCTS: PublicProductList = {
  items: [],
  page: 1,
  pageSize: PUBLIC_PAGE_SIZE,
  total: 0,
  hasMore: false,
};

export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const url = new URL(request.url);
  const query = readCatalogQuery(url);
  const sort = readSort(url);

  const [productsResult, categoriesResult] = await Promise.allSettled([
    listPublicProducts(runtime.api, slug, {
      category: query.category ?? undefined,
      q: query.q ?? undefined,
      page: query.page,
    }),
    listPublicCategories(runtime.api, slug),
  ]);

  if (categoriesResult.status === "rejected") {
    throwApiFailure(runtime, categoriesResult.reason, "products.categories_failed");
  }

  let products: PublicProductList = EMPTY_PRODUCTS;
  let categoryMissing = false;

  if (productsResult.status === "fulfilled") {
    products = productsResult.value;
  } else if (isCategoryNotFound(productsResult.reason)) {
    categoryMissing = true;
    products = { ...EMPTY_PRODUCTS, page: query.page };
  } else {
    throwApiFailure(runtime, productsResult.reason, "products.list_failed");
  }

  const items = products.items.map((product) => ({
    ...product,
    priceLabel: formatStorePrice(product.priceMinor, product.currency),
  }));

  if (sort === "price-asc") {
    items.sort((a, b) => a.priceMinor - b.priceMinor);
  } else if (sort === "price-desc") {
    items.sort((a, b) => b.priceMinor - a.priceMinor);
  }

  return {
    siteId,
    query,
    sort,
    products: {
      ...products,
      items,
    },
    categoryMissing,
    categories: categoriesResult.value.items.map((c) => ({
      slug: c.slug,
      label: c.name,
      productCount: c.productCount,
    })),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches[0]?.loaderData as RootData | undefined;
  const own = matches.at(-1)?.loaderData as Awaited<ReturnType<typeof loader>> | undefined;
  const store = root?.store;
  if (!root || !store) {
    return [{ title: "Productos" }];
  }

  const activeCategory = own?.query.category
    ? own.categories.find((c) => c.slug === own.query.category)?.label ?? own.query.category
    : null;
  const title = activeCategory
    ? `${activeCategory} · Productos · ${store.name}`
    : `Productos · ${store.name}`;

  return seoDescriptors({
    title,
    description: `Explora todos los productos disponibles en ${store.name} y haz tu pedido directo por WhatsApp.`,
    canonical: `${root.canonicalBase}${productsHref()}`,
    noindex: root.noindex,
    siteName: store.name,
    image: store.logoUrl,
  });
}

export default function ProductsPage({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<RootData>("root");
  const storeName = root?.store?.name ?? "Tienda";
  const { products, query, sort, categories, categoryMissing, siteId } = loaderData;
  const pages = totalPages(products.total, products.pageSize);

  const activeCategoryLabel = query.category
    ? categories.find((c) => c.slug === query.category)?.label ?? query.category
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 border-b-[length:var(--border-width)] border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav aria-label="Ruta de navegación" className="mb-2 flex items-center gap-1.5 text-xs text-text-muted">
            <Link to={productsHref({ siteId }).replace("/productos", "/")} className="hover:text-text">
              Inicio
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-text">Productos</span>
          </nav>
          <h1 className="font-heading text-2xl font-[var(--font-heading-weight,600)] tracking-[var(--tracking-heading,normal)] sm:text-3xl">
            {activeCategoryLabel ? activeCategoryLabel : `Catálogo de ${storeName}`}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {products.total === 1 ? "1 producto" : `${products.total} productos`} disponibles
          </p>
        </div>

        <Form method="get" action="/productos" className="flex items-center gap-2">
          {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
          {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
          {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
          <label htmlFor="catalog-sort" className="text-xs font-medium text-text-muted">
            Ordenar:
          </label>
          <Select
            id="catalog-sort"
            name="sort"
            defaultValue={sort}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-9 w-44 text-sm"
          >
            <option value="default">Destacados</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </Select>
          <noscript>
            <Button type="submit" size="sm" variant="secondary">
              Aplicar
            </Button>
          </noscript>
        </Form>
      </div>

      <CatalogToolbar
        categories={categories}
        query={query}
        siteId={siteId}
        basePath="/productos"
        sort={sort !== "default" ? sort : null}
      />

      {products.items.length === 0 ? (
        <EmptyState
          title={
            categoryMissing
              ? "Esa categoría no existe"
              : query.q || query.category
                ? "No encontramos productos con ese filtro"
                : "Todavía no hay productos publicados"
          }
          description={
            categoryMissing || query.q || query.category
              ? "Prueba con otra búsqueda o vuelve a ver todo el catálogo."
              : "Pronto añadiremos novedades a este catálogo."
          }
          action={
            query.q || query.category || categoryMissing ? (
              <Button asChild variant="secondary" size="md">
                <Link to={productsHref({ siteId })}>Ver todos los productos</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} siteId={siteId} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Paginación del catálogo" className="flex items-center justify-center gap-2 pt-4">
          {products.page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link
                to={productsHref({
                  category: query.category,
                  q: query.q,
                  sort: sort !== "default" ? sort : null,
                  page: products.page - 1,
                  siteId,
                })}
              >
                Anterior
              </Link>
            </Button>
          ) : null}
          <span className="px-3 text-sm text-text-muted tabular-nums">
            Página {products.page} de {pages}
          </span>
          {products.hasMore ? (
            <Button asChild variant="secondary" size="sm">
              <Link
                to={productsHref({
                  category: query.category,
                  q: query.q,
                  sort: sort !== "default" ? sort : null,
                  page: products.page + 1,
                  siteId,
                })}
              >
                Siguiente
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
