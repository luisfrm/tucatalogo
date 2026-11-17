import { describe, expect, it } from "vitest";

import { InvalidColorError } from "../src/color";
import {
  COLOR_MODE_ATTRIBUTE,
  renderAdminCss,
  renderAdminStyleTag,
  renderThemeBootstrap,
  renderThemeCss,
  renderThemeCssFor,
  renderThemeStyleTag,
  renderThemeStyleTagFor,
  renderTokensCss,
  surfaceSelector,
  themeSelector,
  tokensToCssVariables,
} from "../src/injector";
import { THEME_TOKEN_CSS_VARS, THEME_TOKEN_KEYS } from "../src/tokens";
import { getTheme } from "../src/themes/index";
import { commercialTheme } from "../src/themes/admin";
import { ThemeNotAvailableError } from "../src/types";

describe("tokensToCssVariables", () => {
  it("emite los 31 tokens del contrato con su variable CSS", () => {
    const css = tokensToCssVariables(getTheme("rose").modes.light);
    for (const key of THEME_TOKEN_KEYS) {
      expect(css).toContain(`${THEME_TOKEN_CSS_VARS[key]}:`);
    }
    expect(css.split("\n")).toHaveLength(THEME_TOKEN_KEYS.length);
  });

  it("rechaza valores con caracteres que romperían el <style>", () => {
    const tokens = { ...getTheme("rose").modes.light, bg: "red;</style><script>" };
    expect(() => tokensToCssVariables(tokens)).toThrow(/no permitidos/);
  });
});

describe("selectores", () => {
  it("claro es el estado por defecto y oscuro se activa por atributo", () => {
    expect(themeSelector("rose", "light")).toBe('[data-theme="rose"]');
    expect(themeSelector("rose", "dark")).toBe(
      '[data-theme="rose"][data-color-mode="dark"]',
    );
    expect(surfaceSelector("panel-admin", "dark")).toBe(
      '[data-surface="panel-admin"][data-color-mode="dark"]',
    );
  });
});

describe("CSS del tema", () => {
  it("incluye color-scheme correcto y todos los tokens en cada modo", () => {
    const theme = getTheme("nude-studio");
    for (const mode of ["light", "dark"] as const) {
      const css = renderThemeStyleTag("nude-studio", theme.modes[mode], mode);
      expect(css).toContain(`color-scheme: ${mode}`);
      expect(css.startsWith("<style")).toBe(true);
      for (const key of THEME_TOKEN_KEYS) {
        expect(css, key).toContain(THEME_TOKEN_CSS_VARS[key]);
      }
      if (mode === "dark") {
        expect(css).toContain(`[${COLOR_MODE_ATTRIBUTE}="dark"]`);
      }
    }
  });

  it("renderThemeCssFor resuelve tema + modo + color del cliente", () => {
    const css = renderThemeCssFor({
      themeId: "rose",
      mode: "dark",
      primaryColor: "#C09299",
    });
    expect(css).toContain('[data-theme="rose"][data-color-mode="dark"]');
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--color-primary: #c09299;");
  });

  it("el color del cliente cambia el CSS; sin color se usan los tokens del tema", () => {
    const withColor = renderThemeCssFor({
      themeId: "rose",
      mode: "light",
      primaryColor: "#0EA5E9",
    });
    const staticCss = renderThemeCssFor({ themeId: "rose", mode: "light" });
    expect(withColor).not.toBe(staticCss);
    expect(staticCss).toContain("--color-primary: #8E5F67;");
  });

  it("añade nonce de CSP cuando se pasa", () => {
    const css = renderThemeStyleTagFor(
      { themeId: "rose", mode: "light" },
      { nonce: "abc123" },
    );
    expect(css).toContain('<style nonce="abc123">');
  });

  it("renderThemeCss conserva la firma anterior (themeId, tokens, mode)", () => {
    const theme = getTheme("velvet-noir");
    expect(renderThemeCss("velvet-noir", theme.modes.light, "light")).toBe(
      renderTokensCss('[data-theme="velvet-noir"]', theme.modes.light, "light"),
    );
  });
});

describe("bootstrap SSR", () => {
  it("devuelve atributos, style y preload de fuentes del tema", () => {
    const boot = renderThemeBootstrap({
      themeId: "sol-de-verano",
      mode: "light",
      primaryColor: "#C2410C",
    });
    expect(boot.htmlAttributes).toBe(
      'data-theme="sol-de-verano" data-color-mode="light"',
    );
    expect(boot.styleTag).toContain("--color-primary:");
    expect(boot.preloadLinks).toContain("fredoka-latin.woff2");
    expect(boot.preloadLinks).toContain("nunito-latin.woff2");
    expect(boot.preloadLinks).toContain('as="font"');
    expect(boot.themeId).toBe("sol-de-verano");
    expect(boot.tokens.primary).toBeTruthy();
  });

  it("oscuro por cookie: el modo oscuro sale en el HTML inicial", () => {
    const boot = renderThemeBootstrap({
      themeId: "urban-slate",
      mode: "dark",
      primaryColor: "#3F5568",
    });
    expect(boot.htmlAttributes).toContain('data-color-mode="dark"');
    expect(boot.styleTag).toContain("color-scheme: dark");
  });

  it("falla con tema o color inválido, sin producir HTML a medias", () => {
    expect(() =>
      renderThemeBootstrap({ themeId: "rose-malo", mode: "light" }),
    ).toThrow(ThemeNotAvailableError);
    expect(() =>
      renderThemeBootstrap({
        themeId: "rose",
        mode: "light",
        primaryColor: "rgb(1,2,3)",
      }),
    ).toThrow(InvalidColorError);
  });
});

describe("CSS de administración", () => {
  it("emite el bloque de cada superficie con sus atributos", () => {
    const panel = renderAdminCss({
      surface: "panel-admin",
      primaryColor: "#C09299",
    });
    expect(panel).toContain('[data-surface="panel-admin"]');
    expect(panel).toContain("color-scheme: light");

    const consoleCss = renderAdminStyleTag({ surface: "console", mode: "dark" });
    expect(consoleCss).toContain(
      '[data-surface="console"][data-color-mode="dark"]',
    );
    expect(consoleCss).toContain("color-scheme: dark");

    const commercial = renderAdminCss({ surface: "commercial" });
    expect(commercial).toContain("--color-primary: #8E5F67;");
    expect(commercial).toContain("--color-accent: #C09299;");
    expect(commercialTheme("light").onPrimary).toBe("#FFFFFF");
  });

  it("panel-admin exige el color de la tienda", () => {
    expect(() => renderAdminCss({ surface: "panel-admin" })).toThrow(
      InvalidColorError,
    );
  });
});
