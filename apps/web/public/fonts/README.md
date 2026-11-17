# Fuentes del storefront (copia de `packages/themes/fonts`)

`apps/web` sirve las fuentes self-hosted en `/fonts/*` (PLAN §10.9). Los
ficheros son **copias** de `packages/themes/fonts`:

- woff2 variables, subset latino, generados/descargados por `packages/themes`.
- licencias OFL 1.1 en `licenses/` (una por familia).
- El injector SSR solo emite `@font-face` de las dos familias del tema activo y
  precarga esas mismas dos (`renderFontFaceCss` / `themePreloadLinks`).

Si cambian las fuentes del sistema de diseño, hay que volver a copiarlas desde
`packages/themes/fonts` (no se editan aquí).
