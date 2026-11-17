/**
 * Contrato de tokens (PLAN §10.2). Todo tema define el mismo conjunto;
 * los componentes solo usan tokens, nunca colores "sueltos".
 *
 * Mapa de uso que verifican los tests de contraste:
 * - Botones: `primary` + `onPrimary`, hover con `primaryHover`, `radiusMd`,
 *   `borderWidth`, foco con `ring`; `danger` + `textInverse`; WhatsApp con
 *   `whatsapp` + `onWhatsapp`.
 * - Tarjetas: `surface`, `border`, `radiusLg`, `shadowMd` (hover: `shadowLg`).
 * - Chips/superficies teñidas: `primarySubtle` con `primary` o `text` encima.
 * - Precio: `price` (AA sobre `surface` en los 10 pares tema/modo).
 * - Estados: `success`, `warning`, `danger` como texto sobre `surface`.
 * - Enlaces: `primary` sobre `surface`/`bg`; foco: `ring` 3:1 sobre `bg`.
 * - Tipografía: `fontHeading` en títulos y `fontBody` en cuerpo y UI.
 */
export const THEME_TOKEN_KEYS = [
  "bg",
  "surface",
  "surface2",
  "text",
  "textMuted",
  "textInverse",
  "primary",
  "onPrimary",
  "primaryHover",
  "primarySubtle",
  "accent",
  "accentOn",
  "border",
  "borderStrong",
  "ring",
  "price",
  "whatsapp",
  "onWhatsapp",
  "success",
  "warning",
  "danger",
  "fontHeading",
  "fontBody",
  "radiusSm",
  "radiusMd",
  "radiusLg",
  "radiusFull",
  "borderWidth",
  "shadowSm",
  "shadowMd",
  "shadowLg",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];

export type ThemeTokens = Record<ThemeTokenKey, string>;

export const THEME_TOKEN_CSS_VARS: Record<ThemeTokenKey, string> = {
  bg: "--color-bg",
  surface: "--color-surface",
  surface2: "--color-surface-2",
  text: "--color-text",
  textMuted: "--color-text-muted",
  textInverse: "--color-text-inverse",
  primary: "--color-primary",
  onPrimary: "--color-on-primary",
  primaryHover: "--color-primary-hover",
  primarySubtle: "--color-primary-subtle",
  accent: "--color-accent",
  accentOn: "--color-accent-on",
  border: "--color-border",
  borderStrong: "--color-border-strong",
  ring: "--color-ring",
  price: "--color-price",
  whatsapp: "--color-whatsapp",
  onWhatsapp: "--color-on-whatsapp",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
  fontHeading: "--font-heading",
  fontBody: "--font-body",
  radiusSm: "--radius-sm",
  radiusMd: "--radius-md",
  radiusLg: "--radius-lg",
  radiusFull: "--radius-full",
  borderWidth: "--border-width",
  shadowSm: "--shadow-sm",
  shadowMd: "--shadow-md",
  shadowLg: "--shadow-lg",
};
