import { describe, expect, it } from "vitest";

import {
  BRAND_FALLBACK_WIDTH_RATIO,
  BRAND_WEBFONT_METRICS,
  FONT_BASE_PATH,
  LATIN_UNICODE_RANGE,
  THEME_FONTS,
  THEME_FONT_FALLBACKS,
  THEME_FONT_SLUGS,
  renderFallbackFontFaceCss,
  renderFontFaceCss,
  renderFontFaceStyleTag,
  themeFontFiles,
  themePreloadLinks,
  type BrandFontSlug,
} from "../src/fonts";
import { THEME_IDS } from "../src/ids";
import { ThemeNotAvailableError } from "../src/types";

describe("fuentes self-hosted", () => {
  it("cada familia declara woff2, subset latino y licencia OFL", () => {
    for (const [slug, font] of Object.entries(THEME_FONTS)) {
      expect(font.slug).toBe(slug);
      expect(font.file.endsWith("-latin.woff2")).toBe(true);
      expect(font.license).toBe("OFL-1.1");
      expect(font.licenseFile.startsWith("licenses/")).toBe(true);
      expect(font.unicodeRange).toBe(LATIN_UNICODE_RANGE);
      expect(font.weight).toMatch(/^\d+( \d+)?$/);
      expect(font.copyright).toContain("Copyright");
    }
  });

  it("cada tema usa como máximo dos familias y todas existen", () => {
    for (const themeId of THEME_IDS) {
      const slugs = THEME_FONT_SLUGS[themeId];
      expect(slugs).toHaveLength(2);
      expect(new Set(slugs).size).toBeLessThanOrEqual(2);
      for (const slug of slugs) {
        expect(THEME_FONTS[slug]).toBeTruthy();
      }
    }
  });

  it("emite @font-face con font-display: swap y la ruta de assets", () => {
    const css = renderFontFaceCss({ families: ["fraunces", "figtree"] });
    expect(css).toContain('font-family: "Fraunces";');
    expect(css).toContain('font-family: "Figtree";');
    expect(css).toContain("font-display: swap");
    expect(css).toContain("format(\"woff2\")");
    expect(css).toContain(`${FONT_BASE_PATH}/fraunces-latin.woff2`);
    expect(css).toContain(`unicode-range: ${LATIN_UNICODE_RANGE};`);
  });

  it("permite servir los ficheros desde otra ruta", () => {
    const css = renderFontFaceCss({
      basePath: "/assets/fonts/",
      families: ["inter"],
    });
    expect(css).toContain('url("/assets/fonts/inter-latin.woff2")');
    expect(renderFontFaceStyleTag({ families: ["inter"] })).toContain(
      "<style data-fonts=\"self-hosted\">",
    );
  });

  it("deduplica familias y devuelve una sola entrada para Urban Slate", () => {
    expect(themeFontFiles("rose")).toHaveLength(2);
    const urban = themeFontFiles("urban-slate");
    expect(urban).toHaveLength(1);
    expect(urban[0]?.family).toBe("Outfit");
  });

  it("precarga solo las familias del tema activo", () => {
    expect(themePreloadLinks("velvet-noir")).toContain(
      'href="/fonts/playfair-display-latin.woff2"',
    );
    expect(themePreloadLinks("velvet-noir")).toContain(
      'href="/fonts/montserrat-latin.woff2"',
    );
    expect(themePreloadLinks("velvet-noir")).not.toContain("fredoka");
    expect(themePreloadLinks("velvet-noir")).toContain('crossorigin="anonymous"');
  });

  it("registra la sustitución de marca con métricas derivadas de la webfont", () => {
    const css = renderFallbackFontFaceCss();
    expect(css).toContain('font-family: "Fraunces Fallback";');
    expect(css).toContain('src: local("Georgia");');
    expect(css).toContain("size-adjust: 107.25%;");
    expect(css).toContain("ascent-override: 91.19%;");
    expect(css).toContain("descent-override: 23.78%;");
    expect(css).toContain('font-family: "Figtree Fallback";');
    expect(css).toContain("size-adjust: 100%;");
    expect(css).toContain("ascent-override: 95%;");
    expect(css).toContain("descent-override: 25%;");
  });

  it("no declara nombres `local()` que no resuelven (genéricos o alias)", () => {
    // `local()` solo casa con caras instaladas: `local("Serif")` o
    // `local("sans-serif")` no resuelven y dejan la cara sin ajuste métrico.
    const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i;
    for (const fallback of Object.values(THEME_FONT_FALLBACKS)) {
      expect(fallback.localSources.length).toBeGreaterThan(0);
      for (const name of fallback.localSources) {
        expect(generic.test(name)).toBe(false);
        expect(name).toBe(name.trim());
        expect(name).not.toContain('"');
      }
    }
    expect(THEME_FONT_FALLBACKS.fraunces.localSources).toEqual(["Georgia"]);
    expect(THEME_FONT_FALLBACKS.figtree.localSources[0]).toBe("Arial");
  });

  it("mantiene los overrides coherentes con `size-adjust` y la métrica real", () => {
    const parse = (value: string) => Number.parseFloat(value.replace("%", "")) / 100;
    for (const fallback of Object.values(THEME_FONT_FALLBACKS)) {
      const metrics = BRAND_WEBFONT_METRICS[fallback.slug as BrandFontSlug];
      const ratio = parse(fallback.sizeAdjust);
      expect(ratio).toBeCloseTo(fallback.sizeAdjustRatio, 6);
      expect(fallback.sizeAdjustRatio).toBe(BRAND_FALLBACK_WIDTH_RATIO[fallback.slug as BrandFontSlug]);
      // El override se aplica sobre el em ya escalado: webfont ÷ size-adjust.
      expect(parse(fallback.ascentOverride) * ratio).toBeCloseTo(metrics.ascent, 3);
      expect(parse(fallback.descentOverride) * ratio).toBeCloseTo(metrics.descent, 3);
      expect(parse(fallback.lineGapOverride) * ratio).toBeCloseTo(metrics.lineGap, 3);
    }
  });

  it("no cae a las fuentes del sistema si el tema no existe", () => {
    expect(() => themeFontFiles("rose-ish")).toThrow(ThemeNotAvailableError);
    expect(() => themePreloadLinks("")).toThrow(ThemeNotAvailableError);
  });
});
