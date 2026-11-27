import { getPublicProduct, listPublicProducts } from "@tucatalogo/api-client";
import { Button } from "@tucatalogo/ui";
import { Link, useRouteLoaderData } from "react-router";

import type { Route } from "./+types/product";

import { ProductCard } from "~/components/product-card";
import { ProductGallery } from "~/components/product-gallery";
import { formatStorePrice, priceDecimal } from "~/lib/price";
import { notFound, resolveStoreQuery, throwApiFailure } from "~/lib/runtime.server";
import { seoDescriptors, truncateText } from "~/lib/seo";
import type { RootData } from "~/lib/store-context";
import { homeHref, productHref, productsHref } from "~/lib/urls";
import { resolveWhatsappLink } from "~/lib/whatsapp";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const productSlug = params.slug?.trim();

  if (!productSlug) {
    throw notFound();
  }

  try {
    const product = await getPublicProduct(runtime.api, slug, productSlug);
    const relatedList = await listPublicProducts(runtime.api, slug, {
      category: product.category?.slug,
      page: 1,
    }).catch(() => null);

    const related = (relatedList?.items ?? [])
      .filter((item) => item.id !== product.id)
      .slice(0, 4)
      .map((item) => ({
        ...item,
        priceLabel: formatStorePrice(item.priceMinor, item.currency),
      }));

    return {
      siteId,
      product,
      related,
      priceLabel: formatStorePrice(product.priceMinor, product.currency),
      priceNumeric: priceDecimal(product.priceMinor, product.currency),
    };
  } catch (error) {
    return throwApiFailure(runtime, error, "product.fetch_failed", { productSlug });
  }
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches[0]?.loaderData as RootData | undefined;
  const own = matches.at(-1)?.loaderData as Awaited<ReturnType<typeof loader>> | undefined;
  const store = root?.store;
  const product = own?.product;

  if (!root || !store || !product || !own) {
    return [{ title: "Producto" }];
  }

  const canonical = `${root.canonicalBase}${productHref(product.slug)}`;
  const description = truncateText(
    product.description?.trim() ||
      `Compra ${product.name} en ${store.name}. Pide por WhatsApp y recibe atención personalizada.`,
  );

  return seoDescriptors({
    title: `${product.name} · ${store.name}`,
    description,
    canonical,
    noindex: root.noindex,
    siteName: store.name,
    type: "product",
    image: product.images[0]?.fullUrl ?? store.logoUrl,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description ?? undefined,
      image: product.images.map((image) => image.fullUrl),
      sku: product.id,
      brand: { "@type": "Brand", name: store.name },
      offers: {
        "@type": "Offer",
        price: own.priceNumeric,
        priceCurrency: product.currency,
        availability: "https://schema.org/InStock",
        url: canonical,
      },
    },
  });
}

export default function Product({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<RootData>("root");
  const { product, related, siteId, priceLabel } = loaderData;
  const whatsapp = resolveWhatsappLink(product.whatsappUrl);

  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Ruta de navegación" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
        <Link to={homeHref({ siteId })} className="hover:text-text">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={productsHref({ siteId })} className="hover:text-text">
          Productos
        </Link>
        {product.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              to={productsHref({ category: product.category.slug, siteId })}
              className="hover:text-text"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-text">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-4">
          {product.category ? (
            <Link
              to={productsHref({ category: product.category.slug, siteId })}
              className="inline-flex w-fit min-h-9 items-center rounded-full border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-xs font-medium uppercase tracking-wide text-text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
            >
              {product.category.name}
            </Link>
          ) : null}

          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl">
              {product.name}
            </h1>
            <p className="text-2xl font-semibold text-price">{priceLabel}</p>
          </div>

          {whatsapp ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="whatsapp" size="lg" fullWidth className="sm:w-auto">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.25 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
                  </svg>
                  Pedir por WhatsApp
                </a>
              </Button>
              <p className="text-xs text-text-muted">
                Te responderemos por WhatsApp para confirmar disponibilidad y entrega.
              </p>
            </div>
          ) : null}

          {product.description ? (
            <div className="border-t-[length:var(--border-width)] border-border pt-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Descripción
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-text">
                {product.description}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-text-muted">
            Precio en {product.currency}. Los pedidos se coordinan por WhatsApp.
          </p>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="relacionados-titulo" className="mt-12 border-t-[length:var(--border-width)] border-border pt-8">
          <div className="mb-5 flex items-center justify-between">
            <h2
              id="relacionados-titulo"
              className="font-heading text-xl font-[var(--font-heading-weight,600)] tracking-[var(--tracking-heading,normal)]"
            >
              También te puede interesar
            </h2>
            <Link
              to={productsHref({ category: product.category?.slug, siteId })}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver más
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} siteId={siteId} headingTag="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {root?.store ? (
        <p className="mt-10 text-xs text-text-muted">
          {product.name} forma parte del catálogo de {root.store.name}.
        </p>
      ) : null}
    </article>
  );
}
