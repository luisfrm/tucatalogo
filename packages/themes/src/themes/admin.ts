import type { ColorMode } from "@tucatalogo/types";

import { applyPrimaryColor, InvalidColorError, type ThemeColorProfile } from "../color";
import type { ThemeTokens } from "../tokens";

/**
 * Superficies de administración (PLAN §10.4): usan el mismo contrato de tokens
 * que los temas de tienda, pero con paleta neutra y tipografía de sistema.
 * Nunca heredan la tipografía decorativa del storefront.
 */
export const ADMIN_SURFACES = ["panel-admin", "console", "commercial"] as const;

export type AdminSurface = (typeof ADMIN_SURFACES)[number];

const SYSTEM_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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

/** Console: neutro de densidad alta, radios mínimos, tablas. */
const CONSOLE_NEUTRAL: Record<ColorMode, ThemeTokens> = {
  light: {
    bg: "#F5F6F7",
    surface: "#FFFFFF",
    surface2: "#EEF0F2",
    text: "#14181D",
    textMuted: "#57606B",
    textInverse: "#FFFFFF",
    primary: "#2F3B4A",
    onPrimary: "#FFFFFF",
    primaryHover: "#242E3A",
    primarySubtle: "#E7EAEE",
    accent: "#2F3B4A",
    accentOn: "#FFFFFF",
    border: "#E0E3E7",
    borderStrong: "#848D99",
    ring: "#2F3B4A",
    price: "#1B202A",
    whatsapp: "#14795B",
    onWhatsapp: "#FFFFFF",
    success: "#186B41",
    warning: "#7A5008",
    danger: "#9B2828",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.125rem",
    radiusMd: "0.25rem",
    radiusLg: "0.375rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 1px rgb(20 24 29 / 0.06)",
    shadowMd: "0 2px 6px rgb(20 24 29 / 0.08)",
    shadowLg: "0 8px 18px rgb(20 24 29 / 0.1)",
  },
  dark: {
    bg: "#0D1014",
    surface: "#141920",
    surface2: "#1B2128",
    text: "#E6EAF0",
    textMuted: "#9FA9B6",
    textInverse: "#0D1014",
    primary: "#BFCAD8",
    onPrimary: "#0D1014",
    primaryHover: "#D2DBE6",
    primarySubtle: "#1B2128",
    accent: "#BFCAD8",
    accentOn: "#0D1014",
    border: "#232A33",
    borderStrong: "#59636F",
    ring: "#BFCAD8",
    price: "#E6EAF0",
    whatsapp: "#4BB894",
    onWhatsapp: "#0A1D17",
    success: "#4FB98D",
    warning: "#DCAA55",
    danger: "#EC8E8E",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.125rem",
    radiusMd: "0.25rem",
    radiusLg: "0.375rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 1px rgb(0 0 0 / 0.45)",
    shadowMd: "0 2px 6px rgb(0 0 0 / 0.5)",
    shadowLg: "0 8px 18px rgb(0 0 0 / 0.55)",
  },
};

/**
 * Commercial: neutro orientado a conversión.
 * CTA `#8E5F67` con texto blanco; `#C09299` como acento de marca.
 */
const COMMERCIAL_TOKENS: Record<ColorMode, ThemeTokens> = {
  light: {
    bg: "#FBF9F8",
    surface: "#FFFFFF",
    surface2: "#F7F0F0",
    text: "#1C1416",
    textMuted: "#5E5054",
    textInverse: "#FFFFFF",
    primary: "#8E5F67",
    onPrimary: "#FFFFFF",
    primaryHover: "#7A4F57",
    primarySubtle: "#F7E7E9",
    accent: "#C09299",
    accentOn: "#2B1C20",
    border: "#EADFE0",
    borderStrong: "#8F7A7E",
    ring: "#8E5F67",
    price: "#3A2C2F",
    whatsapp: "#14795B",
    onWhatsapp: "#FFFFFF",
    success: "#1C7A49",
    warning: "#82560A",
    danger: "#A32B2B",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.375rem",
    radiusMd: "0.625rem",
    radiusLg: "1rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 2px rgb(28 20 22 / 0.06)",
    shadowMd: "0 8px 20px rgb(28 20 22 / 0.08)",
    shadowLg: "0 20px 44px rgb(28 20 22 / 0.12)",
  },
  dark: {
    bg: "#131011",
    surface: "#1B1718",
    surface2: "#241E20",
    text: "#F6EFEE",
    textMuted: "#C0AFB1",
    textInverse: "#131011",
    primary: "#E0A9B3",
    onPrimary: "#2B1C20",
    primaryHover: "#ECBAC3",
    primarySubtle: "#322528",
    accent: "#C09299",
    accentOn: "#2B1C20",
    border: "#302729",
    borderStrong: "#6E5A5E",
    ring: "#E0A9B3",
    price: "#F6EFEE",
    whatsapp: "#4FBF9B",
    onWhatsapp: "#0B1F19",
    success: "#52BF92",
    warning: "#E0B05A",
    danger: "#F09292",
    fontHeading: SYSTEM_SANS,
    fontBody: SYSTEM_SANS,
    radiusSm: "0.375rem",
    radiusMd: "0.625rem",
    radiusLg: "1rem",
    radiusFull: "9999px",
    borderWidth: "1px",
    shadowSm: "0 1px 2px rgb(0 0 0 / 0.45)",
    shadowMd: "0 8px 20px rgb(0 0 0 / 0.5)",
    shadowLg: "0 20px 44px rgb(0 0 0 / 0.55)",
  },
};

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

/** Console: densidad alta, sin color de marca. */
export function consoleTheme(mode: ColorMode = "light"): ThemeTokens {
  return { ...CONSOLE_NEUTRAL[mode] };
}

/** Commercial: neutro de conversión con CTA profundo y acento de marca. */
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
