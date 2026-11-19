import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BRAND_MARK_GLYPH, BRAND_MARK_TILE_RADIUS, BRAND_MARK_VIEWBOX } from "../src/brand-mark";

/**
 * El monograma existe dos veces por necesidad: como componente React (para las
 * cabeceras) y como SVG generado (`assets/brand/mark.svg`, generado por
 * `scripts/brand/build.mjs`). Este test es la cuerda que los mantiene iguales:
 * si alguien retoca uno y no el otro, falla.
 */
function readMark(): string {
  return readFileSync(
    fileURLToPath(new URL("../../../assets/brand/mark.svg", import.meta.url)),
    "utf8",
  );
}

describe("BrandMark", () => {
  it("dibuja el monograma con geometría, no con texto", () => {
    const svg = readMark();

    expect(svg).not.toContain("<text");
    expect(svg).toContain(`viewBox="0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}"`);
    expect(svg).toContain(`rx="${BRAND_MARK_TILE_RADIUS}"`);
  });

  it("coincide pieza a pieza con assets/brand/mark.svg", () => {
    const svg = readMark();

    for (const shape of BRAND_MARK_GLYPH) {
      if (shape.kind === "rect") {
        expect(svg).toContain(
          `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"/>`,
        );
      } else {
        expect(svg).toContain(`<path d="${shape.d}"/>`);
      }
    }
  });
});
