import { describe, expect, it } from "vitest";

import { contrastRatio, hexToOklch, isHexColor } from "../src/color";
import { THEME_IDS } from "../src/ids";
import { THEME_TOKEN_CSS_VARS, THEME_TOKEN_KEYS } from "../src/tokens";
import type { ThemeTokens } from "../src/tokens";
import {
  IMPLEMENTED_THEME_IDS,
  getTheme,
  isThemeImplemented,
  listImplementedThemes,
  listThemeMetadata,
  resolveThemeTokens,
  themeMetadata,
} from "../src/themes/index";
import { ThemeNotAvailableError } from "../src/types";

const MODES = ["light", "dark"] as const;

/** Pares exigidos en los 10 combinaciones tema/modo (PLAN §10.7). */
const CONTRAST_RULES: Array<{
  label: string;
  fg: keyof ThemeTokens;
  bg: keyof ThemeTokens;
  min: number;
}> = [
  { label: "texto sobre fondo", fg: "text", bg: "bg", min: 4.5 },
  { label: "texto sobre superficie", fg: "text", bg: "surface", min: 4.5 },
  { label: "texto sobre superficie 2", fg: "text", bg: "surface2", min: 4.5 },
  { label: "texto secundario", fg: "textMuted", bg: "surface", min: 4.5 },
  { label: "texto secundario sobre superficie 2", fg: "textMuted", bg: "surface2", min: 4.5 },
  { label: "texto de botón primario", fg: "onPrimary", bg: "primary", min: 4.5 },
  {
    label: "texto de botón en hover",
    fg: "onPrimary",
    bg: "primaryHover",
    min: 4.5,
  },
  { label: "enlace primario", fg: "primary", bg: "surface", min: 4.5 },
  { label: "texto sobre sutil", fg: "text", bg: "primarySubtle", min: 4.5 },
  { label: "acento como texto", fg: "accent", bg: "surface", min: 4.5 },
  { label: "texto sobre acento", fg: "accentOn", bg: "accent", min: 4.5 },
  { label: "precio", fg: "price", bg: "surface", min: 4.5 },
  { label: "botón WhatsApp", fg: "onWhatsapp", bg: "whatsapp", min: 4.5 },
  { label: "estado success", fg: "success", bg: "surface", min: 4.5 },
  { label: "estado warning", fg: "warning", bg: "surface", min: 4.5 },
  { label: "estado danger", fg: "danger", bg: "surface", min: 4.5 },
  { label: "texto sobre botón danger", fg: "textInverse", bg: "danger", min: 4.5 },
  { label: "foco sobre fondo", fg: "ring", bg: "bg", min: 3 },
  { label: "foco sobre superficie", fg: "ring", bg: "surface", min: 3 },
  { label: "borde fuerte de control", fg: "borderStrong", bg: "surface", min: 3 },
  { label: "borde divisorio visible", fg: "border", bg: "surface", min: 1.2 },
];

describe("los 5 temas de tienda", () => {
  it("están todos implementados y en orden", () => {
    expect(IMPLEMENTED_THEME_IDS).toEqual([...THEME_IDS]);
    expect(listImplementedThemes()).toHaveLength(5);
    for (const id of THEME_IDS) {
      expect(isThemeImplemented(id)).toBe(true);
      expect(getTheme(id).id).toBe(id);
    }
  });

  it("Rosé es el tema por defecto con su color de marca", () => {
    expect(getTheme("rose").defaultPrimaryColor).toBe("#C09299");
  });

  it("cada tema define los 31 tokens con valor en claro y oscuro", () => {
    for (const theme of listImplementedThemes()) {
      for (const mode of MODES) {
        const tokens = theme.modes[mode];
        for (const key of THEME_TOKEN_KEYS) {
          expect(tokens[key], `${theme.id}/${mode}/${key}`).toBeTruthy();
        }
        expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_KEYS].sort());
      }
    }
  });

  it("todos los tokens de color son hex válidos", () => {
    for (const theme of listImplementedThemes()) {
      for (const mode of MODES) {
        const tokens = theme.modes[mode];
        for (const key of THEME_TOKEN_KEYS) {
          if (THEME_TOKEN_CSS_VARS[key].startsWith("--color-")) {
            expect(isHexColor(tokens[key]), `${theme.id}/${mode}/${key}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it("cada tema usa como máximo dos familias tipográficas", () => {
    for (const theme of listImplementedThemes()) {
      const families = new Set([
        theme.fontFamilies.heading,
        theme.fontFamilies.body,
      ]);
      expect(families.size).toBeLessThanOrEqual(2);
      for (const mode of MODES) {
        expect(theme.modes[mode].fontHeading).toContain(
          theme.fontFamilies.heading,
        );
        expect(theme.modes[mode].fontBody).toContain(theme.fontFamilies.body);
      }
    }
  });

  it("los tokens estáticos (color por defecto) cumplen AA en los 10 pares", () => {
    for (const theme of listImplementedThemes()) {
      for (const mode of MODES) {
        const tokens = theme.modes[mode];
        for (const rule of CONTRAST_RULES) {
          const ratio = contrastRatio(tokens[rule.fg], tokens[rule.bg]);
          expect(
            ratio,
            `${theme.id}/${mode} · ${rule.label} = ${ratio}:1`,
          ).toBeGreaterThanOrEqual(rule.min);
        }
      }
    }
  });

  it("los tokens derivados (color de marca) también cumplen AA", () => {
    for (const theme of listImplementedThemes()) {
      for (const mode of MODES) {
        const tokens = resolveThemeTokens({
          themeId: theme.id,
          mode,
          primaryColor: theme.defaultPrimaryColor,
        });
        for (const rule of CONTRAST_RULES) {
          const ratio = contrastRatio(tokens[rule.fg], tokens[rule.bg]);
          expect(
            ratio,
            `${theme.id}/${mode} (${theme.defaultPrimaryColor}) · ${rule.label}`,
          ).toBeGreaterThanOrEqual(rule.min);
        }
      }
    }
  });

  it("cada tema tiene su propio sistema de diseño", () => {
    const signatures = listImplementedThemes().map((theme) => {
      const t = theme.modes.light;
      return [
        theme.fontFamilies.heading,
        theme.fontFamilies.body,
        t.radiusMd,
        t.borderWidth,
        t.shadowMd,
        t.bg,
        t.accent,
      ].join("|");
    });
    expect(new Set(signatures).size).toBe(5);
  });

  it("las sombras y radios son valores CSS, no hex sueltos", () => {
    for (const theme of listImplementedThemes()) {
      for (const mode of MODES) {
        const t = theme.modes[mode];
        for (const key of ["shadowSm", "shadowMd", "shadowLg"] as const) {
          expect(t[key]).not.toMatch(/#[0-9a-f]{6}/i);
        }
      }
    }
  });

  it("expone metadata completa para el picker", () => {
    const metadata = listThemeMetadata();
    expect(metadata).toHaveLength(5);
    for (const entry of metadata) {
      expect(entry.id).toBe(themeMetadata(entry.id).id);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.swatches).toHaveLength(4);
      for (const swatch of entry.swatches) {
        expect(isHexColor(swatch)).toBe(true);
      }
      expect(entry.fonts.heading.length).toBeGreaterThan(0);
      expect(entry.fonts.body.length).toBeGreaterThan(0);
      expect(entry.availableModes).toEqual(["light", "dark"]);
      expect(entry.highlights.length).toBeGreaterThan(0);
    }
  });

  it("el color de marca del picker tiene el tono del tema", () => {
    const rose = hexToOklch(themeMetadata("rose").swatches[0]);
    const urban = hexToOklch(themeMetadata("urban-slate").swatches[0]);
    expect(Math.abs(rose.h - urban.h)).toBeGreaterThan(90);
  });

  it("no cae a un tema por defecto", () => {
    expect(() => getTheme("nude-studios")).toThrow(ThemeNotAvailableError);
    expect(isThemeImplemented("nude-studios")).toBe(false);
  });
});
