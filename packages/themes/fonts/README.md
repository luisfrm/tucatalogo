# Fuentes self-hosted

Ficheros `woff2`, subset **latino** (el `unicode-range` exacto está en
`THEME_FONTS` de `src/fonts.ts`), variable cuando la familia lo permite.
Nunca se carga Google Fonts en runtime: se sirven desde este directorio.

| Tema | Títulos | Cuerpo | Ficheros |
| --- | --- | --- | --- |
| `rose` | Fraunces (`100 900`) | Figtree (`300 900`) | `fraunces-latin.woff2`, `figtree-latin.woff2` |
| `nude-studio` | Cormorant Garamond (`300 700`) | Inter (`100 900`) | `cormorant-garamond-latin.woff2`, `inter-latin.woff2` |
| `velvet-noir` | Playfair Display (`400 900`) | Montserrat (`100 900`) | `playfair-display-latin.woff2`, `montserrat-latin.woff2` |
| `sol-de-verano` | Fredoka (`300 700`) | Nunito (`200 900`) | `fredoka-latin.woff2`, `nunito-latin.woff2` |
| `urban-slate` | Outfit (`100 900`) | Outfit | `outfit-latin.woff2` |

Total: 9 ficheros, ~343 KB. Cada tema carga como máximo dos (Urban Slate, una).

## Licencias

Todas son **SIL Open Font License 1.1 (OFL)**. El texto completo de cada
familia está en `licenses/<slug>-OFL.txt`, descargado del repositorio oficial
`google/fonts` (`ofl/<familia>/OFL.txt`). Copyright de cada familia en el campo
`copyright` de `THEME_FONTS`.

## Cómo servirlas

1. `renderFontFaceCss({ families })` genera el CSS `@font-face` con
   `font-display: swap`; `renderFontFaceStyleTag()` lo devuelve listo para el
   `<head>`. La ruta pública por defecto es `/fonts`
   (`FONT_BASE_PATH`), configurable con `basePath`.
2. Los `.woff2` se publican como assets estáticos: copiar el contenido de este
   directorio a `public/fonts` de la app, o importarlos con
   `@tucatalogo/themes/fonts/<fichero>.woff2?url` (export `./fonts/*`).
3. `themePreloadLinks(themeId)` devuelve los `<link rel="preload">` de las dos
   familias del tema (PLAN §9.6: solo lo que se usa en el primer viewport).
4. Los `@font-face` de las **9** familias se pueden emitir una vez en un CSS
   global; el navegador solo descarga las que la página usa. Para el storefront,
   limitar a las dos del tema con `families` evita cualquier descarga extra.

```ts
// En el <head> del storefront (SSR)
const boot = renderThemeBootstrap({ themeId, mode, primaryColor });
// boot.styleTag       → <style> con las variables del tema
// boot.preloadLinks   → <link rel="preload"> de las 2 familias
// boot.htmlAttributes → data-theme="..." data-color-mode="..."
```

## Reemplazar o añadir familias

1. Descargar el `woff2` del subset latino y su `OFL.txt`.
2. Registrar la familia en `THEME_FONTS` (`src/fonts.ts`) con peso,
   `unicode-range`, licencia y copyright.
3. Apuntarla en `THEME_FONT_SLUGS` del tema y actualizar `fontFamilies` y los
   tokens `fontHeading` / `fontBody` de `src/themes/<tema>.ts`.

Los tests de `test/fonts.test.ts` verifican que cada tema declare como máximo
dos familias, que todas existan en el registro y que el CSS lleve
`font-display: swap` y la licencia.
