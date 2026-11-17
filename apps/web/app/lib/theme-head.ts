import {
  FONT_BASE_PATH,
  renderAdminCss,
  renderFontFaceCss,
  renderThemeBootstrap,
  renderThemeCss,
  themeFontFiles,
} from "@tucatalogo/themes";
import type { ColorMode } from "@tucatalogo/types";

import type { StorefrontThemeHead } from "./store-context";

/**
 * Acento neutro del **surface** de administración (`packages/themes` lo usa en
 * `PANEL_NEUTRAL`). No es un tema de tienda ni un fallback silencioso: es la
 * base explícita del panel cuando todavía no hay sesión o cuando la tienda
 * pública responde 404 (suspendida/eliminada) y no hay color que heredar.
 *
 * En cuanto la sesión del dueño está disponible, el root usa el
 * `primaryColor` real de `getPanelStore`.
 */
export const PANEL_BASE_ACCENT: Record<ColorMode, string> = {
  light: "#3E4650",
  dark: "#C7D0DC",
};

/**
 * Injector SSR (PLAN §10.5): el servidor resuelve tema + modo + color y el
 * `<head>` sale con las CSS vars antes del primer pintado.
 *
 * React Router necesita CSS como texto dentro de un `<style>` propio de React,
 * así que se usan los export de `packages/themes` que devuelven CSS
 * (`renderThemeCss`/`renderAdminCss`) y el bootstrap se usa para resolver y
 * validar tema, modo y tokens. Un tema o color inválido lanza
 * (`ThemeNotAvailableError` / `InvalidColorError`): nunca hay tema por defecto.
 */
export function buildStorefrontThemeHead(input: {
  themeId: string;
  primaryColor: string;
  mode: ColorMode;
}): StorefrontThemeHead {
  const bootstrap = renderThemeBootstrap({
    themeId: input.themeId,
    mode: input.mode,
    primaryColor: input.primaryColor,
  });

  const fonts = themeFontFiles(bootstrap.themeId);

  return {
    themeId: bootstrap.themeId,
    mode: bootstrap.mode,
    css: renderThemeCss(bootstrap.themeId, bootstrap.tokens, bootstrap.mode),
    fontFaceCss: renderFontFaceCss({
      basePath: FONT_BASE_PATH,
      families: fonts.map((font) => font.slug),
    }),
    preloadHrefs: fonts.map((font) => `${FONT_BASE_PATH}/${font.file}`),
  };
}

/**
 * `/panel-admin` usa la superficie neutra de administración con el color de la
 * tienda como acento (PLAN §10.4). Sin fuentes decorativas del storefront.
 *
 * `primaryColor` puede faltar **solo** cuando el panel aún no tiene sesión: en
 * ese caso se aplica la base neutra documentada arriba. Con sesión, el root
 * pasa siempre el color de la tienda.
 */
export function buildAdminThemeCss(input: {
  primaryColor: string | null;
  mode: ColorMode;
}): string {
  return renderAdminCss({
    surface: "panel-admin",
    mode: input.mode,
    primaryColor: input.primaryColor ?? PANEL_BASE_ACCENT[input.mode],
  });
}
