/**
 * Cabeceras de seguridad para los worker entries (M2).
 *
 * Reglas:
 * - Nunca sobrescribe una cabecera ya presente (cache-control, set-cookie, CSP…).
 * - Consola y /panel-admin no se pueden enmarcar (DENY + frame-ancestors 'none').
 * - Storefront y commercial permiten enmarcarse solo en el mismo origen.
 * - HSTS únicamente con `ENVIRONMENT === "production"`.
 */

export type SecurityHeadersSurface =
  | "storefront"
  | "commercial"
  | "console"
  | "panel-admin";

export interface SecurityHeadersOptions {
  surface: SecurityHeadersSurface;
  environment: string;
}

export const BASE_PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=()";

export const PRODUCTION_HSTS = "max-age=31536000; includeSubDomains";

function setIfMissing(headers: Headers, name: string, value: string): void {
  if (!headers.has(name)) {
    headers.set(name, value);
  }
}

function hasFrameAncestors(csp: string): boolean {
  return /(^|;)\s*frame-ancestors\b/i.test(csp);
}

function ensureFrameAncestors(headers: Headers, value: string): void {
  const current = headers.get("content-security-policy");

  if (!current) {
    headers.set("content-security-policy", value);
    return;
  }

  if (hasFrameAncestors(current)) {
    return;
  }

  const base = current.trim().replace(/;+\s*$/, "");
  headers.set(
    "content-security-policy",
    base.length > 0 ? `${base}; ${value}` : value,
  );
}

function applySecurityHeaders(
  headers: Headers,
  options: SecurityHeadersOptions,
): void {
  const isAdminSurface =
    options.surface === "console" || options.surface === "panel-admin";

  setIfMissing(headers, "x-content-type-options", "nosniff");
  setIfMissing(
    headers,
    "referrer-policy",
    isAdminSurface ? "no-referrer" : "strict-origin-when-cross-origin",
  );
  setIfMissing(headers, "permissions-policy", BASE_PERMISSIONS_POLICY);

  if (isAdminSurface) {
    setIfMissing(headers, "x-frame-options", "DENY");
    ensureFrameAncestors(headers, "frame-ancestors 'none'");
  } else {
    setIfMissing(headers, "x-frame-options", "SAMEORIGIN");
  }

  if (options.environment === "production") {
    setIfMissing(headers, "strict-transport-security", PRODUCTION_HSTS);
  }
}

function copySetCookies(source: Headers, target: Headers): void {
  const getSetCookie = (
    source as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;

  if (typeof getSetCookie !== "function") {
    return;
  }

  const cookies = getSetCookie.call(source);
  if (cookies.length === 0) {
    return;
  }

  target.delete("set-cookie");
  for (const cookie of cookies) {
    target.append("set-cookie", cookie);
  }
}

/**
 * Añade las cabeceras que falten. Si la Response tiene headers inmutables
 * (redirects), devuelve una copia conservando status, Location y Set-Cookie.
 */
export function withSecurityHeaders(
  response: Response,
  options: SecurityHeadersOptions,
): Response {
  try {
    applySecurityHeaders(response.headers, options);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    applySecurityHeaders(headers, options);
    copySetCookies(response.headers, headers);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
