import { describe, expect, it } from "vitest";

import { contrastRatio, InvalidColorError, isHexColor } from "../src/color";
import { THEME_TOKEN_KEYS } from "../src/tokens";
import type { ThemeTokens } from "../src/tokens";
import {
  ADMIN_SURFACES,
  adminTheme,
  commercialExtraVars,
  commercialTheme,
  consoleExtraVars,
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

  it("consoleTheme comparte identidad con commercial y superficies sobrias", () => {
    for (const mode of MODES) {
      const tokens = consoleTheme(mode);
      expectComplete(tokens, `console/${mode}`);
      // Identidad compartida: misma tipografía y mismo primario.
      expect(tokens.fontHeading).toContain("Fraunces");
      expect(tokens.fontBody).toContain("Figtree");
      expect(tokens.primary).toBe(commercialTheme(mode).primary);
      expect(tokens.fontHeading).toBe(commercialTheme(mode).fontHeading);
      expect(tokens.radiusMd).toBe(commercialTheme(mode).radiusMd);
      expect(tokens.shadowMd).toBe(commercialTheme(mode).shadowMd);
      expect(contrastRatio(tokens.text, tokens.surface)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(tokens.onPrimary, tokens.primary)).toBeGreaterThanOrEqual(
        4.5,
      );
    }

    // Sobriedad: el console no arrastra el mismo fondo que la landing.
    const light = consoleTheme("light");
    const commercial = commercialTheme("light");
    expect(light.bg).not.toBe(commercial.bg);
    expect(light.surface).not.toBe(commercial.surface);
    // Y sigue separado del panel del dueño (que mantiene su neutro).
    const panel = adminTheme("#C09299", "light");
    expect(light.primary).not.toBe(panel.primary);
    expect(light.fontHeading).not.toBe(panel.fontHeading);
  });

  it("commercialTheme usa el CTA cereza con texto blanco", () => {
    const light = commercialTheme("light");
    expectComplete(light, "commercial/light");
    expect(light.primary).toBe("#A40040");
    expect(light.onPrimary).toBe("#FFFFFF");
    expect(light.accent).toBe("#DD6F23");
    expect(contrastRatio(light.onPrimary, light.primary)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(light.accentOn, light.accent)).toBeGreaterThanOrEqual(
      4.5,
    );
    // El primario como texto tiene que ser holgado, no solo AA.
    expect(contrastRatio(light.primary, light.surface)).toBeGreaterThanOrEqual(7);
    expectComplete(commercialTheme("dark"), "commercial/dark");
  });

  it("los tokens extra son aditivos y solo los exponen las superficies de marca", () => {
    const commercial = commercialExtraVars("light");
    const consoleVars = consoleExtraVars("light");
    expect(commercial["--font-display"]).toContain("Fraunces");
    expect(commercial["--gradient-hero"]).toMatch(/^linear-gradient\(/);
    expect(commercial["--gradient-cta"]).toMatch(/^linear-gradient\(/);
    expect(consoleVars["--gradient-header"]).toMatch(/^linear-gradient\(/);
    // No son parte del contrato de 31 claves.
    for (const name of Object.keys(commercial)) {
      expect(THEME_TOKEN_KEYS).not.toContain(name);
    }
    // Y no mutan el estado global del módulo.
    const copy = commercialExtraVars("light");
    copy["--font-display"] = "mutado";
    expect(commercialExtraVars("light")["--font-display"]).toContain("Fraunces");
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
      ["textMuted", "bg", 4.5],
      ["textMuted", "surface", 4.5],
      ["textMuted", "surface2", 4.5],
      ["textInverse", "danger", 4.5],
      ["onPrimary", "primary", 4.5],
      ["onPrimary", "primaryHover", 4.5],
      ["primary", "surface", 4.5],
      ["primary", "bg", 4.5],
      // El par que dejaba pasar el chip del hero (4.41:1).
      ["primary", "primarySubtle", 4.5],
      ["text", "primarySubtle", 4.5],
      ["accentOn", "accent", 4.5],
      ["ring", "bg", 3],
      ["ring", "surface", 3],
      // Borde de input enfocable / campo: contraste no textual.
      ["borderStrong", "surface", 3],
      ["price", "surface", 4.5],
      ["onWhatsapp", "whatsapp", 4.5],
      ["success", "surface", 4.5],
      ["warning", "surface", 4.5],
      ["danger", "surface", 4.5],
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
      if (label.startsWith("panel")) {
        expect(
          contrastRatio(tokens.accent, tokens.surface),
          `${label}: acento como texto`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(tokens.accent, tokens.bg),
          `${label}: acento sobre fondo`,
        ).toBeGreaterThanOrEqual(4.5);
      } else {
        // En las superficies de marca el acento es gráfico (relleno, badge,
        // icono, degradado), nunca texto de cuerpo: 3:1 como componente.
        expect(
          contrastRatio(tokens.accent, tokens.surface),
          `${label}: acento gráfico`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
