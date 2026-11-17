import type { Route } from "./+types/robots";

import { resolveStoreQuery } from "~/lib/runtime.server";
import { storefrontOrigin } from "~/lib/urls";

/**
 * `robots.txt` por tienda (PLAN §15.1). En local/development la tienda completa
 * se cierra y las páginas llevan `noindex`; en producción se publica el sitemap
 * del subdominio.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { slug, runtime } = resolveStoreQuery(request);
  const origin = storefrontOrigin({
    request,
    environment: runtime.environment,
    slug,
    appDomain: runtime.appDomain,
  });

  const body = runtime.isProduction
    ? ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n")
    : ["User-agent: *", "Disallow: /", ""].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": runtime.isProduction ? "public, max-age=3600" : "no-store",
    },
  });
}
