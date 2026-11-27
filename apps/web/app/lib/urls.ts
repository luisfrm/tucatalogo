import type { AppEnvironment } from "./store-context";

/**
 * URLs del storefront. Todo enlaces internos se construyen aquí para conservar
 * `?siteId` (solo dev/local) y los filtros del catálogo.
 */

export type QueryValue = string | number | undefined | null;

export interface StoreHrefOptions {
  /** `?siteId` de la request actual (solo dev/local). */
  siteId?: string | null;
  query?: Record<string, QueryValue>;
}

function appendQuery(path: string, options: StoreHrefOptions = {}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length === 0) continue;
    params.set(key, text);
  }

  if (options.siteId && !params.has("siteId")) {
    params.set("siteId", options.siteId);
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function storeHref(path: string, options: StoreHrefOptions = {}): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return appendQuery(normalized, options);
}

/**
 * Enlaces internos del panel del dueño. `path` es relativo a `/panel-admin`
 * (`""` para el dashboard). Conserva `?siteId` en local/dev igual que el
 * storefront, para que el dueño no pierda la tienda al navegar.
 */
export function panelHref(subpath = "", options: StoreHrefOptions = {}): string {
  const clean = subpath.replace(/^\/+/, "");
  const path = clean ? `/panel-admin/${clean}` : "/panel-admin";
  return storeHref(path, options);
}

export interface CatalogQuery {
  category: string | null;
  q: string | null;
  page: number;
}

function queryText(value: string | null, max: number): string | null {
  if (value === null) return null;
  const text = value.trim();
  if (text.length === 0) return null;
  return text.slice(0, max);
}

/** Lee `?category=&q=&page=` sin confiar en el navegador (PLAN §8.4). */
export function readCatalogQuery(url: URL): CatalogQuery {
  const category = queryText(url.searchParams.get("category"), 80);
  const q = queryText(url.searchParams.get("q"), 80);
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 10_000) : 1;

  return { category, q, page };
}

export interface CatalogHrefInput extends CatalogQuery {
  siteId?: string | null;
}

export function homeHref(input: Partial<CatalogHrefInput> = {}): string {
  const query: Record<string, QueryValue> = {
    category: input.category ?? null,
    q: input.q ?? null,
    page: input.page && input.page > 1 ? input.page : null,
  };
  return storeHref("/", { siteId: input.siteId, query });
}

export function productsHref(
  input: Partial<CatalogHrefInput> & { sort?: string | null } = {},
): string {
  const query: Record<string, QueryValue> = {
    category: input.category ?? null,
    q: input.q ?? null,
    sort: input.sort ?? null,
    page: input.page && input.page > 1 ? input.page : null,
  };
  return storeHref("/productos", { siteId: input.siteId, query });
}

export function productHref(slug: string, options: { siteId?: string | null } = {}): string {
  return storeHref(`/producto/${encodeURIComponent(slug)}`, { siteId: options.siteId });
}

export function categoryHref(slug: string, options: { q?: string | null; siteId?: string | null } = {}): string {
  return homeHref({ category: slug, q: options.q ?? null, siteId: options.siteId });
}

export function pageHref(page: number, input: Omit<CatalogHrefInput, "page">): string {
  return homeHref({ ...input, page });
}

export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Etiqueta legible a partir del slug: el contrato público solo expone slugs. */
export function humanizeCategorySlug(slug: string): string {
  const text = slug.replace(/-+/g, " ").trim();
  if (text.length === 0) return slug;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Base canónica del subdominio de la tienda. En producción siempre el host
 * real (`https://slug.dominio`); fuera de producción se usa el origen de la
 * request (los entornos locales/dev se marcan `noindex`).
 */
export function storefrontOrigin(input: {
  request: Request;
  environment: AppEnvironment;
  slug: string;
  appDomain: string;
}): string {
  if (input.environment === "production") {
    return `https://${input.slug}.${input.appDomain}`;
  }
  return new URL(input.request.url).origin;
}

/**
 * Destino de un redirect POST: solo rutas relativas del mismo origen.
 * Evita `//evil.com`, URLs absolutas y saltos de línea en la cabecera.
 */
export function sanitizeRedirectTarget(value: unknown): string {
  if (typeof value !== "string") return "/";
  const target = value.trim();
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.includes("\\") || target.includes("\n") || target.includes("\r")) return "/";
  return target;
}
