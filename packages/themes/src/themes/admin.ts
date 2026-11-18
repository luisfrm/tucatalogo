import type { ColorMode } from "@tucatalogo/types";

import { applyPrimaryColor, InvalidColorError, type ThemeColorProfile } from "../color";
import type { ThemeTokens } from "../tokens";

/**
 * Superficies de administración (PLAN §10.4): usan el mismo contrato de tokens
 * que los temas de tienda.
 *
 * `commercial` y `console` comparten **una sola identidad de marca** (paleta,
 * tipografía, radios y sombras); `panel-admin` sigue siendo neutro con el color
 * de la tienda como acento y no se toca.
 */
export const ADMIN_SURFACES = ["panel-admin", "console", "commercial"] as const;

export type AdminSurface = (typeof ADMIN_SURFACES)[number];

const SYSTEM_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/* ------------------------------------------------------------------ *
 * Identidad de marca compartida: commercial + console
 * ------------------------------------------------------------------ */

/**
 * Fraunces (display variable) + Figtree (UI humanista), self-hosted en
 * `/fonts` por cada app. Las caras `* Fallback` vienen de
 * `renderBrandFontFaceCss()` en `../fonts` y llevan `size-adjust`, así que el
 * intercambio de `font-display: swap` no mueve el layout.
 */
const BRAND_FONT_HEADING =
  '"Fraunces", "Fraunces Fallback", Georgia, "Times New Roman", serif';
const BRAND_FONT_BODY =
  '"Figtree", "Figtree Fallback", Arial, "Helvetica Neue", sans-serif';

/** Radios y densidad comunes a las dos superficies de marca. */
const BRAND_RADII = {
  radiusSm: "0.375rem",
  radiusMd: "0.625rem",
  radiusLg: "1rem",
  radiusFull: "9999px",
  borderWidth: "1px",
} as const satisfies Partial<ThemeTokens>;

/**
 * Sombras con color: el tinte es el vino de marca (`rgb(122 8 48)`), nunca
 * negro puro. Sobre papel cálido da profundidad sin ensuciar.
 */
const BRAND_SHADOWS_LIGHT = {
  shadowSm: "0 1px 2px rgb(122 8 48 / 0.08), 0 2px 6px rgb(122 8 48 / 0.06)",
  shadowMd: "0 6px 16px rgb(122 8 48 / 0.1), 0 18px 36px rgb(122 8 48 / 0.08)",
  shadowLg: "0 16px 32px rgb(122 8 48 / 0.13), 0 40px 80px rgb(122 8 48 / 0.12)",
} as const satisfies Partial<ThemeTokens>;

const BRAND_SHADOWS_DARK = {
  shadowSm: "0 1px 2px rgb(46 8 24 / 0.55)",
  shadowMd: "0 6px 16px rgb(46 8 24 / 0.6), 0 18px 36px rgb(46 8 24 / 0.4)",
  shadowLg: "0 16px 32px rgb(46 8 24 / 0.65), 0 40px 80px rgb(46 8 24 / 0.45)",
} as const satisfies Partial<ThemeTokens>;

/** Perfil OKLCH de las superficies neutras: el color de marca es acento/CTA. */
const ADMIN_COLOR_PROFILE: ThemeColorProfile = {
  primaryUsage: "both",
  primaryChromaMax: 0.12,
  hoverShift: 0.05,
  subtleLightness: { light: 0.96, dark: 0.24 },
  subtleChromaFactor: 0.3,
  subtleChromaMax: 0.03,
  accentHueBlend: 0.6,
  accentHueMaxRotation: 30,
  accentChromaMax: 0.09,
  accentContrast: 4.5,
};

/** Neutro del panel del dueño: densidad media, mobile-first. */
const PANEL_NEUTRAL: Record<ColorMode, ThemeTokens> = {
  light: {
    bg: "#F7F7F8",
    surface: "#FFFFFF",
    surface2: "#F1F2F4",
    text: "#16181D",
    textMuted: "#5B6470",
    textInverse: "#FFFFFF",
    primary: "#3E4650",
    onPrimary: "#FFFFFF",
    primaryHover: "#313842",
    primarySubtle: "#EAECEF",
    accent: "#3E4650",
    accentOn: "#FFFFFF",
    border: "#E2E4E8",
    borderStrong: "#8A929D",
    ring: "#3E4650",
    price: "#1F2329",
    whatsapp: "#14795B",
    onWhatsapp: "#FFFFFF",
    success: "#1C7A49",
    warning: "#82560A",
    danger: "#A32B2B",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.25rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 2px rgb(22 24 29 / 0.06)",
    shadowMd: "0 4px 12px rgb(22 24 29 / 0.08)",
    shadowLg: "0 16px 32px rgb(22 24 29 / 0.1)",
  },
  dark: {
    bg: "#101216",
    surface: "#16191E",
    surface2: "#1D2127",
    text: "#E9ECF1",
    textMuted: "#A4ADB9",
    textInverse: "#101216",
    primary: "#C7D0DC",
    onPrimary: "#101216",
    primaryHover: "#DCE3EC",
    primarySubtle: "#1D2127",
    accent: "#C7D0DC",
    accentOn: "#101216",
    border: "#262B33",
    borderStrong: "#5C6673",
    ring: "#C7D0DC",
    price: "#E9ECF1",
    whatsapp: "#4FBF9B",
    onWhatsapp: "#0B1F19",
    success: "#52BF92",
    warning: "#E0B05A",
    danger: "#F09292",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.25rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 2px rgb(0 0 0 / 0.45)",
    shadowMd: "0 4px 12px rgb(0 0 0 / 0.5)",
    shadowLg: "0 16px 32px rgb(0 0 0 / 0.55)",
  },
};

/**
 * Console: misma identidad que `commercial` (vivid rose + tangerina, Fraunces +
 * Figtree, mismos radios y sombras), pero **superficies más sobrias**.
 *
 * Matiz de producto: el color vive en la cabecera, los botones primarios, los
 * badges de estado, el ítem de navegación activo y el foco; las tablas y los
 * formularios se quedan sobre papel cálido casi neutro (croma 0.006–0.008) para
 * que una lista de 200 tiendas no canse. En `commercial` el mismo croma se usa
 * a fondo: hero, degradados y bloques de color.
 */
const CONSOLE_TOKENS: Record<ColorMode, ThemeTokens> = {
  light: {
    bg: "#F8F5F1",
    surface: "#FFFDFC",
    surface2: "#F3EEEA",
    text: "#1F1815",
    textMuted: "#5E5450",
    textInverse: "#FFFFFF",
    primary: "#A40040",
    onPrimary: "#FFFFFF",
    primaryHover: "#870037",
    primarySubtle: "#FFE6E8",
    accent: "#DD6F23",
    accentOn: "#2A0F04",
    border: "#E3DFDA",
    borderStrong: "#887E7A",
    ring: "#A40040",
    price: "#6C1735",
    whatsapp: "#1F6B46",
    onWhatsapp: "#FFFFFF",
    success: "#337344",
    warning: "#8D5E00",
    danger: "#A82D2E",
    fontHeading: BRAND_FONT_HEADING,
    fontBody: BRAND_FONT_BODY,
    ...BRAND_RADII,
    ...BRAND_SHADOWS_LIGHT,
  },
  dark: {
    bg: "#120D0F",
    surface: "#1D1619",
    surface2: "#2B2326",
    text: "#F4EFEB",
    textMuted: "#B7ADAA",
    textInverse: "#120D0F",
    primary: "#F87F99",
    onPrimary: "#210D11",
    primaryHover: "#FF9DAF",
    primarySubtle: "#412429",
    accent: "#FF9B51",
    accentOn: "#210E02",
    border: "#352E31",
    borderStrong: "#786E73",
    ring: "#FB89A0",
    price: "#FFDADF",
    whatsapp: "#65D097",
    onWhatsapp: "#07180F",
    success: "#79D28D",
    warning: "#F4C26A",
    danger: "#FB9795",
    fontHeading: BRAND_FONT_HEADING,
    fontBody: BRAND_FONT_BODY,
    ...BRAND_RADII,
    ...BRAND_SHADOWS_DARK,
  },
};

/**
 * Commercial: identidad viva compartida con `console` (ver `CONSOLE_TOKENS`).
 *
 * Derivada de la semilla de marca Rosé `#C09299` = `oklch(0.7054 0.0563 8.44)`
 * subiendo el croma en lugar de apagarlo:
 * - primario cereza/raspberry `#A40040` (`oklch(0.46 0.19 10)`): 7.75:1 como
 *   texto sobre `surface` y 7.92:1 con blanco encima como relleno;
 * - acento tangerina `#DD6F23` (`oklch(0.66 0.16 50)`): relleno, degradado,
 *   badge e icono; nunca texto de cuerpo (3.23:1 sobre `surface`);
 * - neutros de papel cálido (`H 60`) en lugar de grises: `#FCF4EE` de fondo;
 * - `primary` sobre `primarySubtle` 6.69:1: el chip del hero cumple AA.
 *
 * La misma familia, tipografía, radios y sombras que `console`; aquí el color
 * se usa a fondo (`commercialExtraVars`: degradados de hero y CTA).
 */
const COMMERCIAL_TOKENS: Record<ColorMode, ThemeTokens> = {
  light: {
    bg: "#FCF4EE",
    surface: "#FFFCFA",
    surface2: "#FCE8E6",
    text: "#23151A",
    textMuted: "#614C53",
    textInverse: "#FFFFFF",
    primary: "#A40040",
    onPrimary: "#FFFFFF",
    primaryHover: "#870037",
    primarySubtle: "#FFE6E8",
    accent: "#DD6F23",
    accentOn: "#2A0F04",
    border: "#EADCDB",
    borderStrong: "#91797C",
    ring: "#A40040",
    price: "#6C1735",
    whatsapp: "#1F6B46",
    onWhatsapp: "#FFFFFF",
    success: "#337344",
    warning: "#8D5E00",
    danger: "#A82D2E",
    fontHeading: BRAND_FONT_HEADING,
    fontBody: BRAND_FONT_BODY,
    ...BRAND_RADII,
    ...BRAND_SHADOWS_LIGHT,
  },
  dark: {
    bg: "#130A0E",
    surface: "#1E1318",
    surface2: "#2D1F26",
    text: "#F6EEE8",
    textMuted: "#BAAAA6",
    textInverse: "#130A0E",
    primary: "#F87F99",
    onPrimary: "#210D11",
    primaryHover: "#FF9DAF",
    primarySubtle: "#412429",
    accent: "#FF9B51",
    accentOn: "#210E02",
    border: "#382C32",
    borderStrong: "#7E6C74",
    ring: "#FB89A0",
    price: "#FFDADF",
    whatsapp: "#65D097",
    onWhatsapp: "#07180F",
    success: "#79D28D",
    warning: "#F4C26A",
    danger: "#FB9795",
    fontHeading: BRAND_FONT_HEADING,
    fontBody: BRAND_FONT_BODY,
    ...BRAND_RADII,
    ...BRAND_SHADOWS_DARK,
  },
};

/**
 * Tokens que **no** forman parte del contrato de 31 claves y solo se emiten
 * para `commercial`/`console` vía `renderAdminCss({ extraVars })`.
 *
 * Los degradados usan los mismos hex de la paleta: `onPrimary` mantiene AA
 * sobre **todos** los stops (medido: 15.47→10.8 en claro, 7.51→11.1 en oscuro).
 */
const COMMERCIAL_EXTRA_VARS: Record<ColorMode, Readonly<Record<string, string>>> = {
  light: {
    "--font-display": BRAND_FONT_HEADING,
    "--gradient-hero": "linear-gradient(165deg, #FFFCFA 0%, #FCF4EE 52%, #FCE8E6 100%)",
    "--gradient-cta": "linear-gradient(135deg, #A40040 0%, #870037 58%, #6B0029 100%)",
    "--gradient-wash": "radial-gradient(120% 120% at 0% 0%, #FFFCFA 0%, #FCF4EE 55%, #FBE4E6 100%)",
  },
  dark: {
    "--font-display": BRAND_FONT_HEADING,
    "--gradient-hero": "linear-gradient(165deg, #1E1318 0%, #130A0E 55%, #2D1F26 100%)",
    "--gradient-cta": "linear-gradient(135deg, #F87F99 0%, #FF9DAF 55%, #FFB3A0 100%)",
    "--gradient-wash": "radial-gradient(120% 120% at 0% 0%, #1E1318 0%, #130A0E 55%, #2D1F26 100%)",
  },
};

/**
 * Console: el color se concentra en cabecera, navegación activa, botones
 * primarios, badges y foco. La cabecera puede pintarse con este degradado
 * manteniendo texto `onPrimary` (10.8:1 en el stop más claro).
 */
const CONSOLE_EXTRA_VARS: Record<ColorMode, Readonly<Record<string, string>>> = {
  light: {
    "--gradient-header": "linear-gradient(90deg, #A40040 0%, #870037 100%)",
    "--gradient-badge": "linear-gradient(135deg, #FFE6E8 0%, #FCE8E6 100%)",
  },
  dark: {
    "--gradient-header": "linear-gradient(90deg, #F87F99 0%, #FF9DAF 100%)",
    "--gradient-badge": "linear-gradient(135deg, #412429 0%, #2D1F26 100%)",
  },
};

export function commercialExtraVars(
  mode: ColorMode = "light",
): Record<string, string> {
  return { ...COMMERCIAL_EXTRA_VARS[mode] };
}

export function consoleExtraVars(
  mode: ColorMode = "light",
): Record<string, string> {
  return { ...CONSOLE_EXTRA_VARS[mode] };
}

/**
 * `/panel-admin`: neutro con el color principal de la tienda como acento.
 * El primario derivado se usa en CTA y estado activo; el texto del cuerpo
 * sigue siendo neutro (el color de la tienda nunca es fondo de texto).
 */
export function adminTheme(
  primaryColor: string,
  mode: ColorMode = "light",
): ThemeTokens {
  return applyPrimaryColor(
    PANEL_NEUTRAL[mode],
    mode,
    primaryColor,
    ADMIN_COLOR_PROFILE,
  );
}

/** Console: misma identidad que commercial, superficies sobrias. */
export function consoleTheme(mode: ColorMode = "light"): ThemeTokens {
  return { ...CONSOLE_TOKENS[mode] };
}

/** Commercial: identidad viva, la superficie más expresiva de las tres. */
export function commercialTheme(mode: ColorMode = "light"): ThemeTokens {
  return { ...COMMERCIAL_TOKENS[mode] };
}

export interface AdminThemeInput {
  mode?: ColorMode;
  /** Obligatorio en `panel-admin`: es el color de la tienda. */
  primaryColor?: string;
}

/**
 * Punto único de resolución para las tres superficies de administración.
 * `panel-admin` exige color y falla con `InvalidColorError` si falta o es
 * inválido (sin defaults silenciosos).
 */
export function resolveAdminTheme(
  surface: AdminSurface,
  input: AdminThemeInput = {},
): ThemeTokens {
  const mode = input.mode ?? "light";

  switch (surface) {
    case "panel-admin":
      if (input.primaryColor === undefined) {
        throw new InvalidColorError(input.primaryColor);
      }
      return adminTheme(input.primaryColor, mode);
    case "console":
      return consoleTheme(mode);
    case "commercial":
      return commercialTheme(mode);
    default: {
      const exhaustive: never = surface;
      throw new Error(`Superficie de administración desconocida: ${exhaustive}`);
    }
  }
}
