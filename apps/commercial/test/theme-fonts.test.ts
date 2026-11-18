import { describe, expect, it } from "vitest";

import { BRAND_FONT_SLUGS, THEME_FONTS } from "@tucatalogo/themes";

import { loader } from "~/routes/theme-fonts";

/**
 * Las previews de `#temas` solo son honestas si la hoja diferida declara la
 * tipografía real de cada tema. La lista se deriva de `packages/themes`: si se
 * añade una familia nueva y no se excluye la de marca, este test lo detecta.
 */
describe("GET /theme-fonts.css", () => {
  it("sirve las familias de los temas y nunca las de marca", async () => {
    const response = (await loader({} as never)) as Response;
    const css = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(response.headers.get("cache-control")).toContain("max-age");

    const declared = [...css.matchAll(/font-family: "([^"]+)"/g)].map(
      (match) => match[1],
    );
    const expected = Object.values(THEME_FONTS)
      .filter((font) => !(BRAND_FONT_SLUGS as readonly string[]).includes(font.slug))
      .map((font) => font.family);

    expect(declared.sort()).toEqual(expected.sort());
    expect(declared).not.toContain("Fraunces");
    expect(declared).not.toContain("Figtree");

    // Una sola cara por familia: dos ficheros por tema como máximo y sin
    // descargar nada hasta que la landing llega a la sección.
    expect(css.match(/@font-face/g)).toHaveLength(expected.length);
    expect(css).toContain('url("/fonts/cormorant-garamond-latin.woff2")');
    expect(css).toContain("font-display: swap");
  });
});
