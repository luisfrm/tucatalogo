import { describe, expect, it } from "vitest";

import { contrastRatio, InvalidColorError, isHexColor } from "../src/color";
import { THEME_TOKEN_KEYS } from "../src/tokens";
import type { ThemeTokens } from "../src/tokens";
import {
  ADMIN_SURFACES,
  adminTheme,
  commercialTheme,
  consoleTheme,
  resolveAdminTheme,
} from "../src/themes/admin";

const MODES = ["light", "dark"] as const;

function expectComplete(tokens: ThemeTokens, label: string) {
  for (const key of THEME_TOKEN_KEYS) {
    expect(tokens[key], `${label}/${key}`).toBeTruthy();
  }
  expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_KEYS].sort());
}

describe("superficies de administración", () => {
  it("declara las tres superficies del MVP", () => {
    expect(ADMIN_SURFACES).toEqual(["panel-admin", "console", "commercial"]);
  });

  it("adminTheme define el contrato completo en claro y oscuro", () => {
    for (const mode of MODES) {
      expectComplete(adminTheme("#C09299", mode), `panel-admin/${mode}`);
    }
  });

  it("adminTheme usa el color de la tienda como acento y mantiene el texto neutro", () => {
    const rose = adminTheme("#C09299");
    const emerald = adminTheme("#0E7A5F");

    expect(rose.primary).not.toBe(emerald.primary);
    expect(rose.accent).not.toBe(emerald.accent);
    // El texto del cuerpo no es el color de marca (nunca fondo de texto).
    expect(rose.text).toBe(emerald.text);
    expect(isHexColor(rose.primary)).toBe(true);
    expect(contrastRatio(rose.onPrimary, rose.primary)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(rose.text, rose.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("adminTheme falla con color inválido en vez de usar un neutro por defecto", () => {
    expect(() => adminTheme("")).toThrow(InvalidColorError);
    expect(() => resolveAdminTheme("panel-admin", {})).toThrow(
      InvalidColorError,
    );
  });

  it("adminTheme no hereda la tipografía decorativa del storefront", () => {
    const tokens = adminTheme("#C09299");
    expect(tokens.fontHeading).toContain("system-ui");
    expect(tokens.fontBody).toContain("system-ui");
    expect(tokens.fontHeading).not.toMatch(/Fraunces|Playfair|Fredoka|Outfit/);
  });

  it("consoleTheme es neutro y de densidad alta", () => {
    for (const mode of MODES) {
      const tokens = consoleTheme(mode);
      expectComplete(tokens, `console/${mode}`);
      expect(tokens.fontHeading).toContain("system-ui");
      expect(contrastRatio(tokens.text, tokens.surface)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(tokens.onPrimary, tokens.primary)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    const light = consoleTheme("light");
    const panel = adminTheme("#C09299", "light");
    // Densidad: radios más pequeños que el panel.
    expect(light.radiusLg).not.toBe(panel.radiusLg);
    // Neutro: el primario no arrastra el tono de marca.
    expect(light.primary).toBe(consoleTheme("light").primary);
  });

  it("commercialTheme usa el CTA profundo con texto blanco", () => {
    const light = commercialTheme("light");
    expectComplete(light, "commercial/light");
    expect(light.primary).toBe("#8E5F67");
    expect(light.onPrimary).toBe("#FFFFFF");
    expect(light.accent).toBe("#C09299");
    expect(contrastRatio(light.onPrimary, light.primary)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(light.accentOn, light.accent)).toBeGreaterThanOrEqual(
      4.5,
    );
    expectComplete(commercialTheme("dark"), "commercial/dark");
  });

  it("resolveAdminTheme enruta las tres superficies y el modo", () => {
    expect(resolveAdminTheme("console")).toEqual(consoleTheme("light"));
    expect(resolveAdminTheme("commercial", { mode: "dark" })).toEqual(
      commercialTheme("dark"),
    );
    expect(
      resolveAdminTheme("panel-admin", { primaryColor: "#3F5568", mode: "dark" }),
    ).toEqual(adminTheme("#3F5568", "dark"));
  });

  it("todos los pares de texto/UI de administración cumplen AA", () => {
    const rules: Array<[keyof ThemeTokens, keyof ThemeTokens, number]> = [
      ["text", "bg", 4.5],
      ["text", "surface", 4.5],
      ["text", "surface2", 4.5],
      ["textMuted", "surface", 4.5],
      ["textMuted", "surface2", 4.5],
      ["textInverse", "danger", 4.5],
      ["onPrimary", "primary", 4.5],
      ["onPrimary", "primaryHover", 4.5],
      ["primary", "surface", 4.5],
      ["text", "primarySubtle", 4.5],
      ["accentOn", "accent", 4.5],
      ["ring", "bg", 3],
      ["ring", "surface", 3],
      ["success", "surface", 4.5],
      ["warning", "surface", 4.5],
      ["danger", "surface", 4.5],
      ["onWhatsapp", "whatsapp", 4.5],
    ];

    const cases: Array<[string, ThemeTokens]> = [];
    for (const mode of MODES) {
      cases.push([`panel/${mode}`, adminTheme("#C09299", mode)]);
      cases.push([`console/${mode}`, consoleTheme(mode)]);
      cases.push([`commercial/${mode}`, commercialTheme(mode)]);
    }

    for (const [label, tokens] of cases) {
      for (const [fg, bg, min] of rules) {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        expect(ratio, `${label}: ${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min);
      }
      if (label.startsWith("commercial")) {
        // El acento de marca es un color gráfico, no de texto: se exige que
        // se vea sobre la superficie y que su texto propio sea AA.
        expect(
          contrastRatio(tokens.accent, tokens.surface),
          `${label}: acento gráfico`,
        ).toBeGreaterThanOrEqual(2.5);
      } else {
        expect(
          contrastRatio(tokens.accent, tokens.surface),
          `${label}: acento como texto`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(tokens.accent, tokens.bg),
          `${label}: acento sobre fondo`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
