import { getPublicSitemap } from "@tucatalogo/api-client";

import type { Route } from "./+types/sitemap";

import { escapeXml } from "~/lib/seo";
import { resolveStoreQuery, throwApiFailure } from "~/lib/runtime.server";
import { categoryHref, productHref, storefrontOrigin } from "~/lib/urls";

/**
 * `sitemap.xml` por tienda (PLAN §15.1). Solo productos y categorías vivos,
 * con URLs del storefront y `lastmod` de cada entrada.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const origin = storefrontOrigin({
    request,
    environment: runtime.environment,
    slug,
    appDomain: runtime.appDomain,
  });

  let sitemap: Awaited<ReturnType<typeof getPublicSitemap>>;
  try {
    sitemap = await getPublicSitemap(runtime.api, slug);
  } catch (error) {
    return throwApiFailure(runtime, error, "sitemap.fetch_failed");
  }

  const lastmod = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  };

  const entries = [
    `<url><loc>${escapeXml(`${origin}/`)}</loc></url>`,
    ...sitemap.categories.map((category) => {
      const loc = escapeXml(`${origin}${categoryHref(category.slug, { siteId })}`);
      const modified = lastmod(category.updatedAt);
      return `<url><loc>${loc}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`;
    }),
    ...sitemap.products.map((product) => {
      const loc = escapeXml(`${origin}${productHref(product.slug, { siteId })}`);
      const modified = lastmod(product.updatedAt);
      return `<url><loc>${loc}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`;
    }),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": runtime.isProduction ? "public, max-age=3600" : "no-store",
    },
  });
}
