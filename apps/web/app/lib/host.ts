import {
  getSlugRejectionReason,
  isReservedSlug,
  normalizeSlugInput,
} from "@tucatalogo/shared";

/**
 * Resolución del host del storefront (PLAN §4.5 D / §4.2, AGENTS §2).
 *
 * - El ápice y `www` no son tiendas.
 * - Solo un subdominio directo puede ser el slug de una tienda.
 * - Los reservados se rechazan aquí (defensa en profundidad) y también en el API.
 * - `?siteId` sustituye al `Host` **solo** en `local`/`development`; nunca es un
 *   `storeId` de confianza y en producción se rechaza con 400.
 *
 * Esta función es pura: no consulta D1 ni decide si la tienda existe.
 */
export type HostResolutionReason =
  | "ok"
  | "site-id"
  | "root"
  | "invalid"
  | "reserved"
  | "site-id-forbidden"
  | "site-id-invalid";

export interface HostResolution {
  slug: string | null;
  reason: HostResolutionReason;
  /** `?siteId` normalizado cuando se usó como resolución de host. */
  siteId: string | null;
}

export interface ResolveStoreSlugOptions {
  /** Valor crudo de `?siteId`, tal cual llega en la query. */
  siteId?: string | null;
  /** `true` solo en `local`/`development` (leído del entorno del worker). */
  allowSiteId?: boolean;
}

export function resolveStoreSlug(
  hostname: string,
  appDomain: string,
  options: ResolveStoreSlugOptions = {},
): HostResolution {
  const rawSiteId = typeof options.siteId === "string" ? options.siteId.trim() : "";

  if (rawSiteId.length > 0) {
    if (!options.allowSiteId) {
      return { slug: null, reason: "site-id-forbidden", siteId: null };
    }

    const siteId = normalizeSlugInput(rawSiteId);
    const rejection = getSlugRejectionReason(siteId);
    if (rejection === "reserved") {
      return { slug: null, reason: "reserved", siteId };
    }
    if (rejection !== null) {
      return { slug: null, reason: "site-id-invalid", siteId };
    }

    return { slug: siteId, reason: "site-id", siteId };
  }

  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  const domain = appDomain.toLowerCase();

  if (host === domain || host === `www.${domain}`) {
    return { slug: null, reason: "root", siteId: null };
  }

  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) {
    return { slug: null, reason: "invalid", siteId: null };
  }

  const slug = host.slice(0, -suffix.length);
  if (slug.length === 0 || slug.includes(".")) {
    return { slug: null, reason: "invalid", siteId: null };
  }

  if (isReservedSlug(slug)) {
    return { slug: null, reason: "reserved", siteId: null };
  }

  // El formato se valida también aquí: un host manipulado no llega al API.
  const rejection = getSlugRejectionReason(slug);
  if (rejection !== null) {
    return { slug: null, reason: "invalid", siteId: null };
  }

  return { slug, reason: "ok", siteId: null };
}

/** `true` cuando la superficie es el panel del dueño (`/panel-admin` y submás rutas). */
export function isPanelAdminPath(pathname: string): boolean {
  return pathname === "/panel-admin" || pathname.startsWith("/panel-admin/");
}

/** `true` cuando el entorno permite `?siteId` como resolución de host. */
export function allowsSiteId(environment: string): boolean {
  return environment === "local" || environment === "development";
}
