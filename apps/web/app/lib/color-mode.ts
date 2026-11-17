import type { ColorMode } from "@tucatalogo/types";

/**
 * Modo claro/oscuro (PLAN §10.7).
 *
 * El modo se decide **en el servidor**: cookie host-only de la tienda y, si no
 * existe, el `colorModeDefault` que viene en D1. El HTML inicial ya sale con el
 * modo correcto, sin parpadeo y sin `useEffect`.
 */
export const COLOR_MODE_COOKIE = "color_mode";

/**
 * El panel del dueño conserva **su** preferencia de modo aparte del storefront:
 * el visitante puede navegar en oscuro mientras el dueño administra en claro.
 * Ambas cookies son host-only (sin `Domain`).
 */
export const PANEL_COLOR_MODE_COOKIE = "panel_color_mode";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

/** Lee una cookie de modo sin adivinar: un valor desconocido se trata como ausente. */
function readModeCookie(
  cookieHeader: string | null | undefined,
  cookieName: string,
): ColorMode | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (name !== cookieName) continue;

    let value = part.slice(separator + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    return isColorMode(value) ? value : null;
  }

  return null;
}

export function parseColorModeCookie(cookieHeader: string | null | undefined): ColorMode | null {
  return readModeCookie(cookieHeader, COLOR_MODE_COOKIE);
}

export function parsePanelColorModeCookie(
  cookieHeader: string | null | undefined,
): ColorMode | null {
  return readModeCookie(cookieHeader, PANEL_COLOR_MODE_COOKIE);
}

export function resolveColorMode(input: {
  cookieHeader?: string | null;
  storeDefault: ColorMode;
}): ColorMode {
  return parseColorModeCookie(input.cookieHeader) ?? input.storeDefault;
}

export function toggleColorMode(mode: ColorMode): ColorMode {
  return mode === "dark" ? "light" : "dark";
}

/**
 * Modo del panel: cookie propia del panel, luego la preferencia de la tienda
 * (si hay sesión) y, si no hay ninguna, claro. El claro no es un tema de
 * negocio: es el modo base explícito de la superficie de administración.
 */
export function resolvePanelColorMode(input: {
  cookieHeader?: string | null;
  storeDefault?: ColorMode | null;
}): ColorMode {
  return (
    parsePanelColorModeCookie(input.cookieHeader) ??
    input.storeDefault ??
    "light"
  );
}

/** Cookie host-only: sin `Domain`, para que cada tienda tenga la suya. */
export function serializeColorModeCookie(
  mode: ColorMode,
  options: { secure?: boolean; panel?: boolean } = {},
): string {
  const name = options.panel ? PANEL_COLOR_MODE_COOKIE : COLOR_MODE_COOKIE;
  const parts = [
    `${name}=${mode}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
