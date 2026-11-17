# `@tucatalogo/themes`

Sistema de diseño de TuCatálogo: los 5 temas de tienda (claro + oscuro), las
tres superficies de administración, el motor de color OKLCH y el injector SSR.
Sin dependencias de runtime más allá de `@tucatalogo/types` (solo tipos).

## Contrato

Cada tema define **el mismo** conjunto de 31 tokens (`THEME_TOKEN_KEYS`), que se
emiten como variables CSS (`THEME_TOKEN_CSS_VARS`). Ningún tema ni componente
introduce un hex fuera de los tokens.

```
--color-bg | --color-surface | --color-surface-2
--color-text | --color-text-muted | --color-text-inverse
--color-primary | --color-on-primary | --color-primary-hover | --color-primary-subtle
--color-accent | --color-accent-on
--color-border | --color-border-strong | --color-ring
--color-price | --color-whatsapp | --color-on-whatsapp
--color-success | --color-warning | --color-danger
--font-heading | --font-body
--radius-sm | --radius-md | --radius-lg | --radius-full
--border-width
--shadow-sm | --shadow-md | --shadow-lg
```

## Temas de tienda

| id | Carácter | Títulos / cuerpo | Radios |
| --- | --- | --- | --- |
| `rose` (default, `#C09299`) | Femenino, suave, sombras difusas | Fraunces / Figtree | grandes |
| `nude-studio` | Neutros cálidos, editorial | Cormorant Garamond / Inter | finos |
| `velvet-noir` | Oscuro-glam con oro | Playfair Display / Montserrat | pequeños |
| `sol-de-verano` | Vivo y cálido | Fredoka / Nunito | muy grandes |
| `urban-slate` | Grises y azul pizarra | Outfit / Outfit | mínimos |

```ts
import {
  getTheme, listThemeMetadata, resolveThemeTokens,
} from "@tucatalogo/themes";

getTheme("rose");                       // ThemeDefinition (lanza si no existe)
listThemeMetadata();                    // picker: id, nombre, swatches, fuentes, modos
resolveThemeTokens({ themeId, mode, primaryColor }); // tokens finales
```

## Motor de color

`packages/themes/src/color.ts` (TS puro, sin dependencias):

- `hexToOklch` / `oklchToHex` (gamut mapping por reducción de croma).
- `contrastRatio`, `relativeLuminance`, `meetsContrast` (WCAG 2.x).
- `ensureContrast(color, background, target)` → ajusta L lo mínimo necesario.
- `pickOnColor` → blanco o casi negro por contraste real.
- `derivePrimaryTokens` / `applyPrimaryColor` → primario, hover, subtle, ring,
  on-primary y acento desde el color del cliente.
- Errores tipados: `InvalidColorError` (400 al escribir) y
  `ThemeNotAvailableError` (500 al leer). Nunca hay color ni tema por defecto.

## Injector SSR (sin FOUC)

```ts
import { renderThemeBootstrap } from "@tucatalogo/themes";

const boot = renderThemeBootstrap({ themeId, mode, primaryColor });
// <html {...}> usa boot.htmlAttributes
// <head> recibe boot.styleTag (CSS vars + color-scheme) y boot.preloadLinks
```

`renderThemeCssFor` / `renderThemeStyleTagFor` devuelven solo el bloque de CSS;
`tokensToCssVariables`, `renderThemeCss` y `renderThemeStyleTag` mantienen la
firma anterior para quien ya serializa tokens a mano.

## Superficies de administración (`src/themes/admin.ts`)

```ts
import {
  ADMIN_SURFACES, adminTheme, consoleTheme, commercialTheme, resolveAdminTheme,
  renderAdminStyleTag,
} from "@tucatalogo/themes";

adminTheme("#C09299", "light");            // panel-admin: neutro + acento de la tienda
consoleTheme("dark");                      // console: neutro, densidad alta
commercialTheme("light");                  // CTA #8E5F67 / acento #C09299
renderAdminStyleTag({ surface: "panel-admin", primaryColor: "#C09299" });
```

Usan el mismo contrato de tokens y tipografía de sistema (no heredan la del
storefront). `panel-admin` exige `primaryColor`: sin color lanza
`InvalidColorError` en lugar de inventar un neutro.

## Fuentes

`fonts/` contiene 9 woff2 variables, subset latino, con su `OFL.txt` en
`fonts/licenses`. Ver `fonts/README.md` para servirlas y precargarlas.

## Tests

```bash
pnpm --filter @tucatalogo/themes typecheck
pnpm --filter @tucatalogo/themes test
```

Cubren: 5 temas × 2 modos con todos los tokens, contraste AA de los tokens
estáticos y de los derivados (incluidos `#000`, `#fff`, muy saturados),
determinismo, errores tipados, contrato del CSS del injector y metadata del
picker.
