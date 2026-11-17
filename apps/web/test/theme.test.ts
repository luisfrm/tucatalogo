import { describe, expect, it } from "vitest";

import {
  buildAdminThemeCss,
  buildStorefrontThemeHead,
} from "../app/lib/theme-head";

describe("injector SSR del tema", () => {
  it("emite los tokens del tema y del modo elegido", () => {
    const head = buildStorefrontThemeHead({
      themeId: "rose",
      primaryColor: "#C09299",
      mode: "dark",
    });

    expect(head.themeId).toBe("rose");
    expect(head.mode).toBe("dark");
    expect(head.css).toContain('[data-theme="rose"][data-color-mode="dark"]');
    expect(head.css).toContain("color-scheme: dark");
    expect(head.css).toContain("--color-primary:");
    expect(head.css).toContain("--font-heading:");
  });

  it("solo emite y precarga las fuentes del tema activo", () => {
    const head = buildStorefrontThemeHead({
      themeId: "rose",
      primaryColor: "#C09299",
      mode: "light",
    });

    expect(head.fontFaceCss).toContain('font-family: "Fraunces"');
    expect(head.fontFaceCss).toContain('font-family: "Figtree"');
    expect(head.fontFaceCss).not.toContain("Playfair");
    expect(head.preloadHrefs).toEqual([
      "/fonts/fraunces-latin.woff2",
      "/fonts/figtree-latin.woff2",
    ]);
  });

  it("aplica el color principal del cliente (motor OKLCH)", () => {
    const withClientColor = buildStorefrontThemeHead({
      themeId: "rose",
      primaryColor: "#1F5F8B",
      mode: "light",
    });
    const withBrandColor = buildStorefrontThemeHead({
      themeId: "rose",
      primaryColor: "#C09299",
      mode: "light",
    });

    expect(withClientColor.css).not.toBe(withBrandColor.css);
    expect(withClientColor.css).toContain('[data-theme="rose"]');
  });

  it("no cae a un tema ni a un color por defecto", () => {
    expect(() =>
      buildStorefrontThemeHead({ themeId: "no-existe", primaryColor: "#C09299", mode: "light" }),
    ).toThrow();
    expect(() =>
      buildStorefrontThemeHead({ themeId: "rose", primaryColor: "rosa", mode: "light" }),
    ).toThrow();
  });

  it("el panel-admin usa la superficie neutra con acento y sin fuentes decorativas", () => {
    const css = buildAdminThemeCss({ primaryColor: "#C09299", mode: "light" });

    expect(css).toContain('[data-surface="panel-admin"]');
    expect(css).toContain("--color-primary:");
    expect(css).not.toContain("Fraunces");
    expect(css).not.toContain("Figtree");
  });

  it("el panel-admin exige un color de tienda", () => {
    expect(() => buildAdminThemeCss({ primaryColor: "", mode: "light" })).toThrow();
  });
});
