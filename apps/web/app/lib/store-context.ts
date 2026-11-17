import type { ColorMode, Currency } from "@tucatalogo/types";

/**
 * Contrato de datos que el loader de `root` entrega a toda la app.
 * Vive en un módulo sin imports de servidor para poder usarlo desde
 * componentes, `meta` y loaders de ruta.
 */
export type AppEnvironment = "local" | "development" | "production";

/** Superficies del worker `web`: storefront público y panel del dueño. */
export type SiteSurface = "storefront" | "panel-admin";

export interface StoreSummary {
  slug: string;
  name: string;
  logoUrl: string | null;
  currency: Currency;
}

export interface StorefrontThemeHead {
  themeId: string;
  mode: ColorMode;
  /** Variables del tema + `color-scheme`. */
  css: string;
  /** `@font-face` de las familias del tema activo. */
  fontFaceCss: string;
  /** Preload de las fuentes del primer viewport. */
  preloadHrefs: string[];
}

export interface RootData {
  requestId: string;
  environment: AppEnvironment;
  /** `true` fuera de producción: `noindex` + `robots.txt` cerrado. */
  noindex: boolean;
  surface: SiteSurface;
  /** `?siteId` de la request (solo dev/local); se propaga en los enlaces. */
  siteId: string | null;
  store: StoreSummary | null;
  mode: ColorMode;
  /** Tema del storefront (solo en `storefront`). */
  theme: StorefrontThemeHead | null;
  /** CSS de la superficie de administración (solo en `panel-admin`). */
  adminCss: string | null;
  /** Origen canónico del subdominio, sin barra final. */
  canonicalBase: string;
}

export function isAppEnvironment(value: string | undefined): value is AppEnvironment {
  return value === "local" || value === "development" || value === "production";
}
