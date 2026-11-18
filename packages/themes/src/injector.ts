import type { ColorMode } from "@tucatalogo/types";

import { themePreloadLinks } from "./fonts";
import type { ThemeId } from "./ids";
import { THEME_TOKEN_CSS_VARS, THEME_TOKEN_KEYS, type ThemeTokens } from "./tokens";
import { getTheme, resolveThemeTokens } from "./themes/index";
import { resolveAdminTheme, type AdminSurface } from "./themes/admin";

/**
 * Emisión SSR del tema (PLAN §10.5): CSS variables antes del primer pintado.
 * El servidor resuelve tema + modo + color y escribe un `<style>` en el
 * `<head>`; no hay JS de cliente ni parpadeo. Un tema o color inválido lanza
 * (`ThemeNotAvailableError` / `InvalidColorError`), nunca cae a un default.
 */

export const THEME_ATTRIBUTE = "data-theme";
export const COLOR_MODE_ATTRIBUTE = "data-color-mode";
export const SURFACE_ATTRIBUTE = "data-surface";

const UNSAFE_CSS_PATTERN = /[<>]/;

/**
 * Tokens fuera del contrato de 31 claves (`--font-display`, degradados,
 * sombras…). Canal **aditivo**: no toca `THEME_TOKEN_KEYS` ni los 5 temas de
 * tienda, así que solo lo usan las superficies que lo piden explícitamente.
 */
export type ExtraVars = Readonly<Record<string, string>>;

/** Nombre de custom property: `--algo-en-kebab-case`. */
const CUSTOM_PROPERTY_PATTERN = /^--[a-z0-9-]+$/;
/** Un valor extra no puede cerrar la declaración ni abrir un bloque. */
const UNSAFE_EXTRA_VALUE_PATTERN = /[<>;{}]/;

export function tokensToCssVariables(tokens: ThemeTokens): string {
  return THEME_TOKEN_KEYS.map((key) => {
    const value = tokens[key];
    if (UNSAFE_CSS_PATTERN.test(value)) {
      throw new Error(
        `Token ${THEME_TOKEN_CSS_VARS[key]} contiene caracteres no permitidos.`,
      );
    }
    return `  ${THEME_TOKEN_CSS_VARS[key]}: ${value};`;
  }).join("\n");
}

/** Serializa los tokens extra con el mismo criterio defensivo que el contrato. */
export function extraVarsToCss(extraVars?: ExtraVars): string {
  if (!extraVars) {
    return "";
  }
  const entries = Object.entries(extraVars);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([name, value]) => {
      if (!CUSTOM_PROPERTY_PATTERN.test(name)) {
        throw new Error(`Token extra con nombre inválido: ${name}`);
      }
      if (UNSAFE_EXTRA_VALUE_PATTERN.test(value)) {
        throw new Error(`Token extra ${name} contiene caracteres no permitidos.`);
      }
      return `  ${name}: ${value};`;
    })
    .join("\n");
}

/** Selector del bloque de tokens: claro por defecto, oscuro por atributo. */
export function themeSelector(themeId: string, mode: ColorMode): string {
  const id = getTheme(themeId).id;
  return mode === "dark"
    ? `[${THEME_ATTRIBUTE}="${id}"][${COLOR_MODE_ATTRIBUTE}="dark"]`
    : `[${THEME_ATTRIBUTE}="${id}"]`;
}

export function surfaceSelector(surface: AdminSurface, mode: ColorMode): string {
  return mode === "dark"
    ? `[${SURFACE_ATTRIBUTE}="${surface}"][${COLOR_MODE_ATTRIBUTE}="dark"]`
    : `[${SURFACE_ATTRIBUTE}="${surface}"]`;
}

export interface RenderCssOptions {
  /** Nonce de CSP para el `<style>` inline. */
  nonce?: string;
}

function styleTag(css: string, options: RenderCssOptions = {}): string {
  const nonce = options.nonce
    ? ` nonce="${options.nonce.replace(/["<>]/g, "")}"`
    : "";
  return `<style${nonce}>${css}</style>`;
}

export function renderTokensCss(
  selector: string,
  tokens: ThemeTokens,
  mode: ColorMode,
  extraVars?: ExtraVars,
): string {
  const declared = tokensToCssVariables(tokens);
  const extra = extraVarsToCss(extraVars);
  return `${selector} {\n  color-scheme: ${mode};\n${declared}${extra ? `\n${extra}` : ""}\n}`;
}

export function renderThemeCss(
  themeId: string,
  tokens: ThemeTokens,
  mode: ColorMode,
): string {
  return renderTokensCss(themeSelector(themeId, mode), tokens, mode);
}

export function renderThemeStyleTag(
  themeId: string,
  tokens: ThemeTokens,
  mode: ColorMode,
  options: RenderCssOptions = {},
): string {
  return styleTag(renderThemeCss(themeId, tokens, mode), options);
}

export interface ThemeRenderInput {
  themeId: string;
  /** Claro por defecto (PLAN §10.7). */
  mode?: ColorMode;
  /** Color de la tienda; si falta, tokens estáticos del tema. */
  primaryColor?: string;
}

/** CSS del tema ya resuelto (tema + modo + color del cliente). */
export function renderThemeCssFor(input: ThemeRenderInput): string {
  const mode = input.mode ?? "light";
  const tokens = resolveThemeTokens({
    themeId: input.themeId,
    mode,
    primaryColor: input.primaryColor,
  });
  return renderThemeCss(input.themeId, tokens, mode);
}

export function renderThemeStyleTagFor(
  input: ThemeRenderInput,
  options: RenderCssOptions = {},
): string {
  return styleTag(renderThemeCssFor(input), options);
}

/** Atributos que el `<html>` debe llevar para que el CSS aplique. */
export function themeHtmlAttributes(
  themeId: string,
  mode: ColorMode,
): string {
  return `${THEME_ATTRIBUTE}="${getTheme(themeId).id}" ${COLOR_MODE_ATTRIBUTE}="${mode}"`;
}

export function surfaceHtmlAttributes(
  surface: AdminSurface,
  mode: ColorMode,
): string {
  return `${SURFACE_ATTRIBUTE}="${surface}" ${COLOR_MODE_ATTRIBUTE}="${mode}"`;
}

export interface ThemeBootstrap {
  themeId: ThemeId;
  mode: ColorMode;
  /** Tokens finales, por si la app los necesita en JS (p. ej. OG image). */
  tokens: ThemeTokens;
  /** Bloque `<style>` para el `<head>`, antes de cualquier contenido. */
  styleTag: string;
  /** Atributos para `<html>`: `data-theme` + `data-color-mode`. */
  htmlAttributes: string;
  /** `<link rel="preload">` de las dos familias del tema. */
  preloadLinks: string;
}

/**
 * Paquete completo para el `<head>` del storefront: variables, atributos y
 * preload de fuentes self-hosted. Todo se calcula en servidor.
 */
export function renderThemeBootstrap(
  input: ThemeRenderInput,
  options: RenderCssOptions = {},
): ThemeBootstrap {
  const mode = input.mode ?? "light";
  const tokens = resolveThemeTokens({
    themeId: input.themeId,
    mode,
    primaryColor: input.primaryColor,
  });

  return {
    themeId: input.themeId as ThemeId,
    mode,
    tokens,
    styleTag: styleTag(renderThemeCss(input.themeId, tokens, mode), options),
    htmlAttributes: themeHtmlAttributes(input.themeId, mode),
    preloadLinks: themePreloadLinks(input.themeId),
  };
}

export interface AdminRenderInput {
  surface: AdminSurface;
  /** Claro por defecto. */
  mode?: ColorMode;
  /** Color de la tienda: obligatorio en `panel-admin`. */
  primaryColor?: string;
  /**
   * Tokens aditivos de la superficie (`--font-display`, degradados…).
   * No forman parte del contrato de 31 claves y ninguna otra superficie los ve.
   */
  extraVars?: ExtraVars;
}

/** CSS de una superficie de administración (panel, console, commercial). */
export function renderAdminCss(input: AdminRenderInput): string {
  const mode = input.mode ?? "light";
  const tokens = resolveAdminTheme(input.surface, {
    mode,
    primaryColor: input.primaryColor,
  });
  return renderTokensCss(
    surfaceSelector(input.surface, mode),
    tokens,
    mode,
    input.extraVars,
  );
}

export function renderAdminStyleTag(
  input: AdminRenderInput,
  options: RenderCssOptions = {},
): string {
  return styleTag(renderAdminCss(input), options);
}
