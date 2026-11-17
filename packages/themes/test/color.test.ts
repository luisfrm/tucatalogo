import { describe, expect, it } from "vitest";

import {
  InvalidColorError,
  applyPrimaryColor,
  blendHue,
  contrastRatio,
  derivePrimaryTokens,
  ensureContrast,
  hexToOklch,
  isHexColor,
  meetsContrast,
  mixHue,
  oklchToHex,
  parseHex,
  pickOnColor,
  relativeLuminance,
  rgbToHex,
} from "../src/color";
import { THEME_IDS } from "../src/ids";
import type { ThemeTokens } from "../src/tokens";
import { getTheme, resolveThemeTokens } from "../src/themes/index";
import { ThemeNotAvailableError } from "../src/types";

const EDGE_COLORS = [
  "#000000",
  "#FFFFFF",
  "#FF00FF",
  "#00FF00",
  "#FF0000",
  "#0000FF",
  "#FFFF00",
  "#7F7F7F",
  "#C09299",
  "#123456",
  "#F5E6D3",
  "#0EA5E9",
];

describe("hex y OKLCH", () => {
  it("acepta #RRGGBB en mayúsculas y minúsculas", () => {
    expect(isHexColor("#C09299")).toBe(true);
    expect(isHexColor("#c09299")).toBe(true);
    expect(parseHex("#C09299")).toEqual({ r: 192, g: 146, b: 153 });
  });

  it("rechaza formatos inválidos con un error tipado 400", () => {
    for (const value of ["#FFF", "C09299", "#GGGGGG", "", "#12345", "red"]) {
      expect(isHexColor(value)).toBe(false);
      expect(() => parseHex(value)).toThrow(InvalidColorError);
    }
    try {
      parseHex("nope");
    } catch (error) {
      expect((error as InvalidColorError).status).toBe(400);
      expect((error as InvalidColorError).code).toBe("INVALID_COLOR");
    }
  });

  it("convierte hex → OKLCH → hex sin perder el color", () => {
    for (const hex of ["#C09299", "#8E5F67", "#000000", "#FFFFFF", "#C2410C"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex.toLowerCase());
    }
  });

  it("calcula L, C y H del color de marca por defecto", () => {
    const oklch = hexToOklch("#C09299");
    expect(oklch.l).toBeGreaterThan(0.6);
    expect(oklch.l).toBeLessThan(0.8);
    expect(oklch.c).toBeGreaterThan(0.03);
    expect(oklch.c).toBeLessThan(0.1);
    expect(oklch.h).toBeGreaterThan(0);
    expect(oklch.h).toBeLessThan(30);
  });

  it("mapea fuera de gamut bajando croma, no recortando canales", () => {
    const hex = oklchToHex({ l: 0.6, c: 0.5, h: 150 });
    expect(isHexColor(hex)).toBe(true);
    const back = hexToOklch(hex);
    expect(back.c).toBeLessThan(0.5);
    expect(Math.abs(back.h - 150)).toBeLessThan(2);
  });
});

describe("contraste WCAG", () => {
  it("blanco contra negro es 21:1 y un color consigo mismo es 1:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#C09299", "#C09299")).toBe(1);
  });

  it("la luminancia relativa va de 0 a 1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBe(1);
  });

  it("meetsContrast aplica el umbral AA pedido", () => {
    expect(meetsContrast("#767676", "#FFFFFF", 4.5)).toBe(true);
    expect(meetsContrast("#949494", "#FFFFFF", 4.5)).toBe(false);
    expect(meetsContrast("#949494", "#FFFFFF", 3)).toBe(true);
  });

  it("rgbToHex es la inversa de parseHex", () => {
    expect(rgbToHex(parseHex("#123456"))).toBe("#123456");
  });
});

describe("ensureContrast", () => {
  it("deja intacto un color que ya cumple", () => {
    const color = hexToOklch("#2C1D21");
    const result = ensureContrast(color, "#FFFFFF", 4.5);
    expect(oklchToHex(result)).toBe("#2c1d21");
  });

  it("oscurece o aclara sólo lo necesario hasta alcanzar AA", () => {
    const result = ensureContrast(hexToOklch("#F5E6D3"), "#FFFFFF", 4.5);
    expect(contrastRatio(oklchToHex(result), "#FFFFFF")).toBeGreaterThanOrEqual(
      4.5,
    );

    const onDark = ensureContrast(hexToOklch("#1B1714"), "#0B090D", 4.5);
    expect(contrastRatio(oklchToHex(onDark), "#0B090D")).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("respeta la dirección pedida", () => {
    const darker = ensureContrast(hexToOklch("#888888"), "#FFFFFF", 4.5, {
      direction: "darken",
    });
    const lighter = ensureContrast(hexToOklch("#888888"), "#FFFFFF", 4.5, {
      direction: "lighten",
    });
    expect(darker.l).toBeLessThan(hexToOklch("#888888").l);
    expect(lighter.l).toBeGreaterThan(hexToOklch("#888888").l);
  });

  it("es determinista", () => {
    const a = ensureContrast(hexToOklch("#C09299"), "#FFFFFF", 4.5);
    const b = ensureContrast(hexToOklch("#C09299"), "#FFFFFF", 4.5);
    expect(a).toEqual(b);
  });
});

describe("on-primary por contraste real", () => {
  it("elige casi negro sobre fondos claros y casi blanco sobre oscuros", () => {
    expect(pickOnColor("#F0D9DC")).toBe("#0F0D0E");
    expect(pickOnColor("#2A1B20")).toBe("#FFFFFF");
  });

  it("elige el candidato con más contraste en el límite", () => {
    // #767676 tiene 4.54:1 con blanco y 4.23:1 con casi negro.
    expect(pickOnColor("#767676")).toBe("#FFFFFF");
  });
});

describe("tonos", () => {
  it("mixHue interpola por el arco más corto", () => {
    expect(mixHue(350, 10, 0.5)).toBeCloseTo(0, 1);
    expect(mixHue(10, 350, 0.5)).toBeCloseTo(0, 1);
    expect(mixHue(200, 100, 0)).toBe(200);
  });

  it("blendHue nunca gira más del máximo", () => {
    expect(Math.abs(blendHue(200, 260, 1, 20) - 200)).toBeLessThanOrEqual(20);
  });

  it("blendHue conserva el tono del tema ante un color casi complementario", () => {
    expect(blendHue(80, 230, 1, 30)).toBe(80);
  });
});

describe("motor de derivación", () => {
  it("es determinista para cualquier combinación", () => {
    for (const themeId of THEME_IDS) {
      const theme = getTheme(themeId);
      for (const mode of ["light", "dark"] as const) {
        const first = applyPrimaryColor(
          theme.modes[mode],
          mode,
          "#0EA5E9",
          theme.colorProfile,
        );
        const second = applyPrimaryColor(
          theme.modes[mode],
          mode,
          "#0EA5E9",
          theme.colorProfile,
        );
        expect(second).toEqual(first);
      }
    }
  });

  it("no muta los tokens estáticos del tema", () => {
    const theme = getTheme("rose");
    const before = JSON.stringify(theme.modes.light);
    applyPrimaryColor(
      theme.modes.light,
      "light",
      "#123456",
      theme.colorProfile,
    );
    expect(JSON.stringify(theme.modes.light)).toBe(before);
  });

  it("mantiene el tono del cliente en el primario", () => {
    const theme = getTheme("sol-de-verano");
    const source = hexToOklch("#7C3AED");
    const derived = derivePrimaryTokens({
      primaryColor: "#7C3AED",
      mode: "dark",
      base: theme.modes.dark,
      profile: theme.colorProfile,
    });
    const hue = hexToOklch(derived.primary).h;
    expect(Math.abs(((hue - source.h + 540) % 360) - 180)).toBeLessThan(6);
  });

  it("on-primary pertenece a los dos candidatos de contraste", () => {
    for (const themeId of THEME_IDS) {
      const theme = getTheme(themeId);
      for (const mode of ["light", "dark"] as const) {
        for (const color of EDGE_COLORS) {
          const derived = derivePrimaryTokens({
            primaryColor: color,
            mode,
            base: theme.modes[mode],
            profile: theme.colorProfile,
          });
          expect(["#FFFFFF", "#0F0D0E"]).toContain(derived.onPrimary);
        }
      }
    }
  });

  it("cumple AA en los 5 temas × 2 modos con colores límite", () => {
    const rules: Array<[keyof ThemeTokens, keyof ThemeTokens, number]> = [
      ["onPrimary", "primary", 4.5],
      ["onPrimary", "primaryHover", 4.5],
      ["primary", "surface", 4.5],
      ["primary", "bg", 4.5],
      ["primary", "primarySubtle", 4.5],
      ["text", "primarySubtle", 4.5],
      ["accent", "surface", 4.5],
      ["accent", "bg", 4.5],
      ["accentOn", "accent", 4.5],
      ["ring", "bg", 3],
      ["ring", "surface", 3],
    ];

    for (const themeId of THEME_IDS) {
      const theme = getTheme(themeId);
      for (const mode of ["light", "dark"] as const) {
        for (const color of [theme.defaultPrimaryColor, ...EDGE_COLORS]) {
          const tokens = resolveThemeTokens({ themeId, mode, primaryColor: color });
          for (const [fg, bg, min] of rules) {
            const ratio = contrastRatio(tokens[fg], tokens[bg]);
            expect(
              ratio,
              `${themeId}/${mode}/${color}: ${fg} sobre ${bg} = ${ratio}`,
            ).toBeGreaterThanOrEqual(min);
          }
        }
      }
    }
  });

  it("un tema desconocido no cae a un tema por defecto", () => {
    expect(() => getTheme("rose-ish")).toThrow(ThemeNotAvailableError);
    expect(() => getTheme("")).toThrow(ThemeNotAvailableError);
    expect(() => resolveThemeTokens({ themeId: "nope", mode: "light" })).toThrow(
      ThemeNotAvailableError,
    );
  });

  it("un color inválido lanza y no devuelve tokens a medias", () => {
    expect(() =>
      resolveThemeTokens({ themeId: "rose", mode: "light", primaryColor: "#ABC" }),
    ).toThrow(InvalidColorError);
  });
});
