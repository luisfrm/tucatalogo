import {
  getPublicHero,
  listPublicCategories,
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
  productsHref,
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

  const [heroResult, productsResult, categoriesResult] = await Promise.allSettled([
    getPublicHero(runtime.api, slug),
    listPublicProducts(runtime.api, slug, {
      category: query.category ?? undefined,
      q: query.q ?? undefined,
      page: query.page,
    }),
    listPublicCategories(runtime.api, slug),
  ]);

  if (heroResult.status === "rejected") {
    throwApiFailure(runtime, heroResult.reason, "home.hero_failed");
  }
  if (categoriesResult.status === "rejected") {
    throwApiFailure(runtime, categoriesResult.reason, "home.categories_failed");
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
    categories: categoriesResult.value.items.map((category) => ({
      slug: category.slug,
      label: category.name,
      productCount: category.productCount,
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
  const hasFilters = Boolean(query.category || query.q || query.page > 1);
  const activeCategory = categories.find((category) => category.slug === query.category);
  const pageOutOfRange = products.items.length === 0 && products.total > 0 && query.page > 1;

  if (!hasFilters) {
    const featuredProducts = products.items.slice(0, 12);

    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:gap-12 sm:px-6 sm:py-8">
        {hero.length > 0 ? (
          <div className="flex flex-col gap-4">
            <h1 className="sr-only">{store?.name ?? "Catálogo"}</h1>
            <HeroCarousel slides={hero} siteId={siteId} />
          </div>
        ) : (
          <section className="rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-border bg-surface p-6 shadow-sm sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Catálogo en línea
                </p>
                <h1 className="mt-2 font-heading text-3xl font-[var(--font-heading-weight,600)] tracking-[var(--tracking-heading,normal)] sm:text-4xl">
                  {store?.name ?? "Catálogo"}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-text-muted sm:text-base">
                  Explora nuestros productos disponibles y haz tu pedido directo por WhatsApp.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link to={productsHref({ siteId })}>Ver productos</Link>
              </Button>
            </div>
          </section>
        )}

        {categories.length > 0 ? (
          <section aria-labelledby="categorias-titulo" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="categorias-titulo"
                className="font-heading text-xl font-[var(--font-heading-weight,600)] tracking-[var(--tracking-heading,normal)] sm:text-2xl"
              >
                Categorías
              </h2>
              <Link
                to={productsHref({ siteId })}
                className="text-sm font-medium text-primary hover:underline"
              >
                Ver todo
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    to={productsHref({ category: category.slug, siteId })}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-card,var(--radius-md))] border-[length:var(--border-width)] border-border bg-surface px-4 py-3 text-sm font-medium text-text shadow-sm transition-all hover:border-primary hover:bg-primary-subtle/40"
                  >
                    <span className="truncate">{category.label}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted tabular-nums">
                      {category.productCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="destacados-titulo" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="destacados-titulo"
                className="font-heading text-xl font-[var(--font-heading-weight,600)] tracking-[var(--tracking-heading,normal)] sm:text-2xl"
              >
                Productos destacados
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {products.total === 0
                  ? "Pronto añadiremos novedades."
                  : `${products.total} ${products.total === 1 ? "producto" : "productos"} disponibles en el catálogo.`}
              </p>
            </div>
            {products.total > 0 ? (
              <Button asChild variant="secondary" size="md">
                <Link to={productsHref({ siteId })}>Ver todo el catálogo</Link>
              </Button>
            ) : null}
          </div>

          {featuredProducts.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {featuredProducts.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} siteId={siteId} headingTag="h3" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Aún no hay productos publicados"
              description="La tienda está preparando su catálogo. Vuelve pronto para ver las novedades."
            />
          )}
        </section>

        <section
          aria-label="Cómo comprar"
          className="grid gap-4 rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-border bg-surface p-5 shadow-sm sm:grid-cols-3 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              Paso 1
            </span>
            <h3 className="font-heading text-base font-semibold text-text">
              Elige tus productos
            </h3>
            <p className="text-xs leading-relaxed text-text-muted">
              Explora las categorías y revisa las fotos y precios actualizados.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              Paso 2
            </span>
            <h3 className="font-heading text-base font-semibold text-text">
              Pide por WhatsApp
            </h3>
            <p className="text-xs leading-relaxed text-text-muted">
              Cada producto abre un mensaje directo con el detalle listo para enviar.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wider text-primary uppercase">
              Paso 3
            </span>
            <h3 className="font-heading text-base font-semibold text-text">
              Coordina pago y entrega
            </h3>
            <p className="text-xs leading-relaxed text-text-muted">
              Acuerda directamente con {store?.name ?? "la tienda"} disponibilidad y envío.
            </p>
          </div>
        </section>
      </div>
    );
  }

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
