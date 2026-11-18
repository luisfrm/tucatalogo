import type { FontSlug } from "@tucatalogo/themes";

import type { Route } from "./+types/theme-fonts";

/**
 * `@font-face` de las familias de los temas que **no** son de marca.
 *
 * Se sirve como hoja aparte para que el navegador no descargue ni un byte de
 * estas 7 familias hasta que la landing se acerca a `#temas`
 * (`ThemeFontLoader`). La lista se deriva de `packages/themes`, no se escribe
 * a mano: si un tema cambia de tipografía, este archivo la sigue.
 *
 * Coste real (woff2 latin, sin comprimir, los ficheros ya van comprimidos):
 * Cormorant Garamond 36.8 KiB · Inter 47.1 KiB · Playfair Display 37.5 KiB ·
 * Montserrat 37.1 KiB · Fredoka 29.0 KiB · Nunito 38.2 KiB · Outfit 31.5 KiB
 * = ~257 KiB, pedidos la primera vez que se acerca la sección y cacheados
 * durante una semana.
 */
export async function loader(_: Route.LoaderArgs) {
  const themes = await import("@tucatalogo/themes");
  const brand = new Set<string>(themes.BRAND_FONT_SLUGS);
  const families = (Object.keys(themes.THEME_FONTS) as FontSlug[]).filter(
    (slug) => !brand.has(slug),
  );

  return new Response(themes.renderFontFaceCss({ families }), {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
