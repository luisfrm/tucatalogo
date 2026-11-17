import {
  getPublicHero,
  getPublicSitemap,
  listPublicProducts,
} from "@tucatalogo/api-client";
import type { PublicProductList } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Link, useRouteLoaderData } from "react-router";

import type { Route } from "./+types/home";

import { CatalogToolbar } from "~/components/catalog-toolbar";
import { EmptyState } from "~/components/empty-state";
import { HeroCarousel } from "~/components/hero-carousel";
import { Pagination } from "~/components/pagination";
import { ProductCard } from "~/components/product-card";
import {
  isCategoryNotFound,
  resolveStoreQuery,
  throwApiFailure,
} from "~/lib/runtime.server";
import { formatStorePrice } from "~/lib/price";
import { seoDescriptors, truncateText } from "~/lib/seo";
import type { RootData } from "~/lib/store-context";
import {
  homeHref,
  humanizeCategorySlug,
  pageHref,
  readCatalogQuery,
} from "~/lib/urls";

/** El API fija 24 por página para el storefront (PLAN §8.2). */
const PUBLIC_PAGE_SIZE = 24;

const EMPTY_PRODUCTS: PublicProductList = {
  items: [],
  page: 1,
  pageSize: PUBLIC_PAGE_SIZE,
  total: 0,
  hasMore: false,
};

export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const query = readCatalogQuery(new URL(request.url));

  const [heroResult, productsResult, sitemapResult] = await Promise.allSettled([
    getPublicHero(runtime.api, slug),
    listPublicProducts(runtime.api, slug, {
      category: query.category ?? undefined,
      q: query.q ?? undefined,
      page: query.page,
    }),
    getPublicSitemap(runtime.api, slug),
  ]);

  if (heroResult.status === "rejected") {
    throwApiFailure(runtime, heroResult.reason, "home.hero_failed");
  }
  if (sitemapResult.status === "rejected") {
    throwApiFailure(runtime, sitemapResult.reason, "home.sitemap_failed");
  }

  let products: PublicProductList = EMPTY_PRODUCTS;
  let categoryMissing = false;

  if (productsResult.status === "fulfilled") {
    products = productsResult.value;
  } else if (isCategoryNotFound(productsResult.reason)) {
    // `?category=` inexistente: el catálogo sigue vivo con estado vacío.
    categoryMissing = true;
    products = { ...EMPTY_PRODUCTS, page: query.page };
  } else {
    throwApiFailure(runtime, productsResult.reason, "home.products_failed");
  }

  return {
    siteId,
    query,
    hero: heroResult.value.items,
    products: {
      ...products,
      items: products.items.map((product) => ({
        ...product,
        priceLabel: formatStorePrice(product.priceMinor, product.currency),
      })),
    },
    categoryMissing,
    categories: sitemapResult.value.categories.map((category) => ({
      slug: category.slug,
      label: humanizeCategorySlug(category.slug),
    })),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches[0]?.loaderData as RootData | undefined;
  const own = matches.at(-1)?.loaderData as Awaited<ReturnType<typeof loader>> | undefined;
  const store = root?.store;
  if (!root || !store) {
    return [{ title: "Catálogo" }];
  }

  const query = own?.query;
  const activeCategory = own?.categories.find((category) => category.slug === query?.category);

  const params = new URLSearchParams();
  if (query?.category) params.set("category", query.category);
  if (query?.q) params.set("q", query.q);
  if (query && query.page > 1) params.set("page", String(query.page));
  const search = params.toString();

  const title = activeCategory
    ? `${activeCategory.label} · ${store.name}`
    : `${store.name} · Catálogo`;
  const description = truncateText(
    activeCategory
      ? `Productos de ${activeCategory.label} en ${store.name}. Precios actualizados y pedidos por WhatsApp.`
      : `Descubre los productos de ${store.name}. Precios actualizados y pedidos por WhatsApp.`,
  );

  return seoDescriptors({
    title,
    description,
    canonical: `${root.canonicalBase}/${search ? `?${search}` : ""}`,
    noindex: root.noindex,
    siteName: store.name,
    type: "website",
    image: store.logoUrl,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<RootData>("root");
  const { query, hero, products, categories, categoryMissing, siteId } = loaderData;
  const store = root?.store;
  const hasFilters = Boolean(query.category || query.q);
  const activeCategory = categories.find((category) => category.slug === query.category);
  const pageOutOfRange = products.items.length === 0 && products.total > 0 && query.page > 1;

  const summary = categoryMissing
    ? "Categoría no encontrada"
    : query.q
      ? `${products.total} ${products.total === 1 ? "resultado" : "resultados"} para “${query.q}”`
      : query.category
        ? `${products.total} ${products.total === 1 ? "producto" : "productos"} en ${
            activeCategory?.label ?? humanizeCategorySlug(query.category)
          }`
        : `${products.total} ${products.total === 1 ? "producto" : "productos"} en el catálogo`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8">
      <HeroCarousel slides={hero} siteId={siteId} />

      <section aria-labelledby="catalogo-titulo" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 id="catalogo-titulo" className="font-heading text-2xl font-semibold sm:text-3xl">
            {store?.name ?? "Catálogo"}
          </h1>
          <p className="text-sm text-text-muted">{summary}</p>
        </div>

        <CatalogToolbar categories={categories} query={query} siteId={siteId} />

        {products.items.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
            {products.items.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} siteId={siteId} />
              </li>
            ))}
          </ul>
        ) : categoryMissing ? (
          <EmptyState
            title="Esa categoría no existe"
            description="Puede que haya cambiado de nombre. Mira todas las categorías disponibles."
            action={
              <Button asChild variant="secondary" size="md">
                <Link to={homeHref({ siteId })}>Ver todo el catálogo</Link>
              </Button>
            }
          />
        ) : pageOutOfRange ? (
          <EmptyState
            title="Esta página del catálogo está vacía"
            description="Te has pasado de la última página de resultados."
            action={
              <Button asChild variant="secondary" size="md">
                <Link to={pageHref(1, { category: query.category, q: query.q, siteId })}>
                  Ir a la primera página
                </Link>
              </Button>
            }
          />
        ) : hasFilters ? (
          <EmptyState
            title="No encontramos productos"
            description={`No hay resultados para “${query.q ?? activeCategory?.label ?? "tu búsqueda"}”. Prueba con otras palabras o quita los filtros.`}
            action={
              <Button asChild variant="secondary" size="md">
                <Link to={homeHref({ siteId })}>Quitar filtros</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Aún no hay productos publicados"
            description="La tienda está preparando su catálogo. Vuelve pronto para ver las novedades."
          />
        )}

        {pageOutOfRange ? null : (
          <Pagination
            page={products.page}
            pageSize={products.pageSize}
            total={products.total}
            query={{ category: query.category, q: query.q }}
            siteId={siteId}
          />
        )}
      </section>
    </div>
  );
}
