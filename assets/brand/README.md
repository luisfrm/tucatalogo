# Activos de marca

Fuente de verdad del logo, el favicon y las imágenes sociales de las dos
superficies de marca:

| Surface | Host | Acento propio |
| --- | --- | --- |
| `commercial` | `tucatalogo.live` | teja vino `#A40040` + monograma blanco |
| `console` | `console.tucatalogo.live` | teja tangerina `#DD6F23` + monograma blanco |

Todo se genera desde un único script, sin dependencias nuevas (Playwright ya
estaba en el repo):

```bash
pnpm brand:build     # escribe los SVG, los PNG y verifica los presupuestos de peso
pnpm brand:preview   # hoja de pruebas en tmp/brand-preview/ (no se despliega)
```

## El monograma

`TC`, dibujado con geometría propia (dos `rect` y un anillo abierto), **no con
`<text>`**: no depende de que ninguna fuente cargue y aguanta 24 px sin
emborronarse. Retícula de 32 unidades, mayúscula de 15.4, asta de 3.7, anillo
de ⌀15.4 con apertura de 104° para que la «C» no lea «O».

El mismo dibujo vive en dos sitios por necesidad:

- `packages/ui/src/brand-mark.tsx` → las cabeceras (React, hereda `currentColor`);
- `assets/brand/mark.svg` → el archivo exportable.

`packages/ui/test/brand-mark.test.ts` compara pieza a pieza los dos y falla si
se separan.

## Ficheros

| Fichero | Para qué |
| --- | --- |
| `mark.svg` | solo la marca (teja vino + monograma blanco), 32 × 32 |
| `logo-commercial.svg` | lockup horizontal: marca + «TuCatálogo» |
| `logo-console.svg` | lockup + chip «Console» |
| `logo-*-mono-on-light.svg` | una tinta con `currentColor` (por defecto negro) para fondos claros |
| `logo-*-mono-on-dark.svg` | una tinta blanca para fondos vino u oscuros |

Los lockups llevan `width`/`height` intrínsecos (40 px de alto) y
`<title>` para lectores de pantalla.

### La tipografía del wordmark

El wordmark va como `<text>` en **Fraunces 600** con la misma cadena de
respaldo que declara el sistema de diseño:

```
Fraunces, 'Fraunces Fallback', Georgia, 'Times New Roman', serif
```

Consecuencia, dicha sin rodeos: **en la app el lockup se compone inline** (marca
SVG + texto vivo) y usa la webfont real; abierto como `<img>` suelto, el SVG
cae a Georgia (la cara de sustitución del sistema, con `size-adjust` en la app).
Se acepta a propósito:

- convertir «TuCatálogo» a curvas pide las 10 glifos de Fraunces 600 (≈10–15 KB
  en paths) y rompe el presupuesto de 6 KB por logo;
- incrustar la woff2 en base64 lo rompe mucho más (67 KB);
- Georgia es la sustituta declarada y medida del sistema (7.25 % más ancha),
  así que el lockup no se rompe ni cambia de voz.

Por eso el `viewBox` reserva un 9 % de aire a la derecha del wordmark: si cae a
Georgia (más ancha), entra igual y nada se recorta.

## Favicon

`favicon.svg` **no es el monograma completo**: a 16 px, dos letras en una teja
de 16 px se embotan. Cada superficie usa **una** de las dos letras, más gruesa y
abierta, con la teja de su color:

| Surface | Favicon | Icono iOS |
| --- | --- | --- |
| `commercial` | «T» blanca sobre vino | 180 × 180, cuadrado a sangre |
| `console` | «C» blanca sobre tangerina | 180 × 180, cuadrado a sangre |

Juntos siguen leyendo «TC» y en una barra de pestañas se distinguen de un
vistazo (letra **y** color). El `apple-touch-icon` va **sin radio y sin
transparencia**: iOS aplica su propia máscara y compone el alfa sobre negro.

Se sirven desde `public/` de cada app; `/favicon.ico` sigue redirigiendo (308) al
SVG en `apps/*/app/routes/favicon.ts`, sin resource route nuevo.

Sin `prefers-color-scheme` a propósito: la teja es opaca y el glifo blanco, así
que el mismo fichero se lee igual en una barra de pestañas clara
(`#dee1e6`) y oscura (`#202124`). Un segundo dibujo para el modo oscuro solo
añadiría bytes y una rama que nadie audita.

## Imágenes sociales

`og.png` (1200 × 630) se renderiza **desde HTML con Playwright**, con las
woff2 reales: el texto es exacto y no hay generadores que deformen letras.
Zona segura de 40 px y todo el texto a ≥ 32 px para que se lea en miniatura.
Composición plana a propósito (sin degradados largos ni ruido) para que el PNG
pese poco.

## Presupuestos

`pnpm brand:build` falla si algo se pasa:

| Activo | Límite |
| --- | --- |
| `favicon.svg` | 2 KB |
| cada logo SVG | 6 KB |
| `og.png` | 200 KB |

## Cómo se revisa

`pnpm brand:preview` escribe `tmp/brand-preview/sheet.png` con:

1. cada lockup a tamaño nativo sobre papel, vino y fondo oscuro, y a 24 px de alto;
2. el favicon **rasterizado a 16 × 16 exactos** y ampliado ×11 con
   `image-rendering: pixelated` (lo que ve el navegador, no un render a 128 px);
3. las dos pestañas juntas, en barra clara y en barra oscura;
4. los iconos de iOS y las dos OG a tamaño real.
