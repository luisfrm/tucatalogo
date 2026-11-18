import { THEME_IDS, type ThemeId } from "./ids";
import { ThemeNotAvailableError } from "./types";

/**
 * Fuentes self-hosted (PLAN §10.9): woff2, subset latino, variable cuando la
 * familia lo permite, `font-display: swap` y licencia OFL junto al archivo.
 * Nunca se carga Google Fonts en runtime: los ficheros viven en
 * `packages/themes/fonts` y la app los sirve como assets estáticos.
 */

export type FontSlug =
  | "fraunces"
  | "figtree"
  | "cormorant-garamond"
  | "inter"
  | "playfair-display"
  | "montserrat"
  | "fredoka"
  | "nunito"
  | "outfit";

export interface ThemeFontFile {
  slug: FontSlug;
  family: string;
  /** Ruta relativa dentro de `packages/themes/fonts`. */
  file: string;
  /** Rango `font-weight` del fichero variable. */
  weight: string;
  style: "normal";
  unicodeRange: string;
  license: "OFL-1.1";
  /** Licencia completa dentro de `packages/themes/fonts/licenses`. */
  licenseFile: string;
  copyright: string;
  /** Origen declarado (Google Fonts, OFL). Solo trazabilidad, no se carga. */
  source: string;
}

/** Subset latino que sirve Google Fonts para estas familias. */
export const LATIN_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

/** Prefijo público por defecto; cada app puede servirlas bajo otra ruta. */
export const FONT_BASE_PATH = "/fonts";

export const THEME_FONTS: Record<FontSlug, ThemeFontFile> = {
  fraunces: {
    slug: "fraunces",
    family: "Fraunces",
    file: "fraunces-latin.woff2",
    weight: "100 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/fraunces-OFL.txt",
    copyright: "Copyright 2018 The Fraunces Project Authors",
    source: "https://fonts.google.com/specimen/Fraunces",
  },
  figtree: {
    slug: "figtree",
    family: "Figtree",
    file: "figtree-latin.woff2",
    weight: "300 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/figtree-OFL.txt",
    copyright: "Copyright 2022 The Figtree Project Authors",
    source: "https://fonts.google.com/specimen/Figtree",
  },
  "cormorant-garamond": {
    slug: "cormorant-garamond",
    family: "Cormorant Garamond",
    file: "cormorant-garamond-latin.woff2",
    weight: "300 700",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/cormorant-garamond-OFL.txt",
    copyright: "Copyright 2015 the Cormorant Project Authors",
    source: "https://fonts.google.com/specimen/Cormorant+Garamond",
  },
  inter: {
    slug: "inter",
    family: "Inter",
    file: "inter-latin.woff2",
    weight: "100 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/inter-OFL.txt",
    copyright: "Copyright 2020 The Inter Project Authors",
    source: "https://fonts.google.com/specimen/Inter",
  },
  "playfair-display": {
    slug: "playfair-display",
    family: "Playfair Display",
    file: "playfair-display-latin.woff2",
    weight: "400 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/playfair-display-OFL.txt",
    copyright: "Copyright 2017 The Playfair Display Project Authors",
    source: "https://fonts.google.com/specimen/Playfair+Display",
  },
  montserrat: {
    slug: "montserrat",
    family: "Montserrat",
    file: "montserrat-latin.woff2",
    weight: "100 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/montserrat-OFL.txt",
    copyright: "Copyright 2024 The Montserrat Project Authors",
    source: "https://fonts.google.com/specimen/Montserrat",
  },
  fredoka: {
    slug: "fredoka",
    family: "Fredoka",
    file: "fredoka-latin.woff2",
    weight: "300 700",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/fredoka-OFL.txt",
    copyright: "Copyright 2016 The Fredoka Project Authors",
    source: "https://fonts.google.com/specimen/Fredoka",
  },
  nunito: {
    slug: "nunito",
    family: "Nunito",
    file: "nunito-latin.woff2",
    weight: "200 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/nunito-OFL.txt",
    copyright: "Copyright 2014 The Nunito Project Authors",
    source: "https://fonts.google.com/specimen/Nunito",
  },
  outfit: {
    slug: "outfit",
    family: "Outfit",
    file: "outfit-latin.woff2",
    weight: "100 900",
    style: "normal",
    unicodeRange: LATIN_UNICODE_RANGE,
    license: "OFL-1.1",
    licenseFile: "licenses/outfit-OFL.txt",
    copyright: "Copyright 2021 The Outfit Project Authors",
    source: "https://fonts.google.com/specimen/Outfit",
  },
};

/** Máximo dos familias por tema (regla del proyecto). */
export const THEME_FONT_SLUGS: Record<ThemeId, readonly [FontSlug, FontSlug]> = {
  rose: ["fraunces", "figtree"],
  "nude-studio": ["cormorant-garamond", "inter"],
  "velvet-noir": ["playfair-display", "montserrat"],
  "sol-de-verano": ["fredoka", "nunito"],
  "urban-slate": ["outfit", "outfit"],
};

export function themeFontFiles(themeId: string): ThemeFontFile[] {
  if (!(THEME_IDS as readonly string[]).includes(themeId)) {
    throw new ThemeNotAvailableError(themeId);
  }
  const slugs = THEME_FONT_SLUGS[themeId as ThemeId];
  const unique = Array.from(new Set(slugs));
  return unique.map((slug) => THEME_FONTS[slug]);
}

export interface RenderFontFaceOptions {
  /** Prefijo público donde la app sirve los woff2. */
  basePath?: string;
  /** Limita la salida a unas familias (por defecto, todas). */
  families?: readonly FontSlug[];
}

export function renderFontFaceCss(options: RenderFontFaceOptions = {}): string {
  const basePath = (options.basePath ?? FONT_BASE_PATH)
    .replace(/\/+$/, "")
    .replace(/["<>;]/g, "");
  const slugs =
    options.families ??
    (Object.keys(THEME_FONTS) as FontSlug[]);

  return slugs
    .map((slug) => {
      const font = THEME_FONTS[slug];
      return [
        "@font-face {",
        `  font-family: "${font.family}";`,
        `  font-style: ${font.style};`,
        `  font-weight: ${font.weight};`,
        "  font-display: swap;",
        `  src: url("${basePath}/${font.file}") format("woff2");`,
        `  unicode-range: ${font.unicodeRange};`,
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

export function renderFontFaceStyleTag(
  options: RenderFontFaceOptions = {},
): string {
  return `<style data-fonts="self-hosted">${renderFontFaceCss(options)}</style>`;
}

/* ------------------------------------------------------------------ *
 * Identidad de marca compartida (commercial + console)
 * ------------------------------------------------------------------ */

/**
 * Par tipográfico de las superficies de marca: Fraunces (display/variable)
 * y Figtree (UI humanista). Es el mismo par que usa el tema Rosé de las
 * tiendas, así la landing y el storefront no cambian de voz.
 */
export const BRAND_FONT_SLUGS = ["fraunces", "figtree"] as const satisfies readonly FontSlug[];

export type BrandFontSlug = (typeof BRAND_FONT_SLUGS)[number];

/**
 * Métricas de la fuente de sustitución, medidas sobre los ficheros reales
 * (fontTools: hhea/OS/2 + ancho medio en Chrome) para que `font-display: swap`
 * no mueva el layout:
 * - `size-adjust` = ancho de la webfont ÷ ancho del fallback;
 * - `ascent/descent-override` = métrica de la webfont ÷ `size-adjust`
 *   (el override se aplica sobre el em ya escalado).
 */
export interface ThemeFontFallback {
  slug: FontSlug;
  /** Nombre con el que se registra la cara de sustitución. */
  family: string;
  /** Candidatas `local()`, en orden de preferencia. */
  localSources: readonly string[];
  sizeAdjust: string;
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
}

export const THEME_FONT_FALLBACKS: Record<BrandFontSlug, ThemeFontFallback> = {
  fraunces: {
    slug: "fraunces",
    family: "Fraunces Fallback",
    localSources: ["Georgia", "Georgia Pro", "Serif"],
    sizeAdjust: "99%",
    ascentOverride: "98.79%",
    descentOverride: "25.76%",
    lineGapOverride: "0%",
  },
  figtree: {
    slug: "figtree",
    family: "Figtree Fallback",
    localSources: ["Arial", "Helvetica Neue", "Helvetica"],
    sizeAdjust: "97.5%",
    ascentOverride: "97.44%",
    descentOverride: "25.64%",
    lineGapOverride: "0%",
  },
};

/** `@font-face` de sustitución con métricas ajustadas (sin descarga). */
export function renderFallbackFontFaceCss(
  families: readonly BrandFontSlug[] = BRAND_FONT_SLUGS,
): string {
  return families
    .map((slug) => {
      const fallback = THEME_FONT_FALLBACKS[slug];
      const local = fallback.localSources.map((name) => `local("${name}")`).join(", ");
      return [
        "@font-face {",
        `  font-family: "${fallback.family}";`,
        `  src: ${local};`,
        `  size-adjust: ${fallback.sizeAdjust};`,
        `  ascent-override: ${fallback.ascentOverride};`,
        `  descent-override: ${fallback.descentOverride};`,
        `  line-gap-override: ${fallback.lineGapOverride};`,
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * `@font-face` de la marca: las dos familias reales (self-hosted, latin) más
 * sus sustituciones ajustadas. Un único bloque para commercial y console.
 */
export function renderBrandFontFaceCss(
  options: RenderFontFaceOptions = {},
): string {
  return `${renderFontFaceCss({
    ...options,
    families: options.families ?? BRAND_FONT_SLUGS,
  })}\n\n${renderFallbackFontFaceCss()}`;
}

/** `<link rel="preload">` de las familias indicadas (una por familia). */
export function fontPreloadLinks(
  families: readonly BrandFontSlug[] = BRAND_FONT_SLUGS,
  basePath: string = FONT_BASE_PATH,
): string {
  return fontPreloadHrefs(families, basePath)
    .map(
      (href) =>
        `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin="anonymous" />`,
    )
    .join("\n");
}

/**
 * Rutas públicas de precarga, para que las apps React puedan emitir `<link>`
 * reales en el `<head>` en lugar de HTML en crudo.
 */
export function fontPreloadHrefs(
  families: readonly BrandFontSlug[] = BRAND_FONT_SLUGS,
  basePath: string = FONT_BASE_PATH,
): string[] {
  const base = basePath.replace(/\/+$/, "");
  return families.map((slug) => `${base}/${THEME_FONTS[slug].file}`);
}

/**
 * Preload de las dos familias del tema (variable: un fichero por familia).
 * PLAN §9.6: solo lo que se usa en el primer viewport.
 */
export function themePreloadLinks(
  themeId: string,
  basePath: string = FONT_BASE_PATH,
): string {
  const base = basePath.replace(/\/+$/, "");
  return themeFontFiles(themeId)
    .map(
      (font) =>
        `<link rel="preload" href="${base}/${font.file}" as="font" type="font/woff2" crossorigin="anonymous" />`,
    )
    .join("\n");
}
