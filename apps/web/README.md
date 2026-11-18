# `@tucatalogo/web`

Storefront público por subdominio y `/panel-admin` del dueño, en un solo worker
React Router v8 (framework mode) sobre Cloudflare Workers con service binding
hacia `apps/api`.

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Home: hero, catálogo, filtro por categoría, búsqueda y paginación de 24 |
| `/?category=&q=&page=` | Mismo catálogo con filtros por query (formulario GET, compartible) |
| `/producto/:slug` | Ficha: galería, precio con la moneda de la tienda, descripción, WhatsApp |
| `/color-mode` | Resource route (POST) que persiste la cookie `color_mode` y redirige |
| `/sitemap.xml` | Sitemap por tienda (`getPublicSitemap` + URLs del storefront) |
| `/robots.txt` | `Disallow: /` fuera de producción; sitemap en producción |
| `/panel-admin` | Placeholder de F5 (login/CRUD los implementa `@panel-dev`) |
| `/health` | Smoke del worker (no resuelve tienda) |

## Resolución de host

`app/lib/host.ts` → `resolveStoreSlug(hostname, appDomain, { siteId, allowSiteId })`.

- `slug.tucatalogo.live` → slug `slug`.
- El apex `tucatalogo.live` (commercial), `www`, `console.tucatalogo.live` y
  `bucket.tucatalogo.live` **no** son tiendas: aunque el wildcard `*` los cubra,
  `web` los rechaza por la lista de reservados (defensa en profundidad).
- Subdominios anidados, hosts ajenos y slugs reservados → 404 (la respuesta no
  distingue tienda inexistente, suspendida o eliminada).
- `?siteId=<slug>` sustituye al host **solo** en `local`/`development`. En
  producción → 400 + log. No otorga permisos: es resolución de host, no un
  `storeId` de confianza.
- El slug se propaga en todos los enlaces internos durante dev/local para que
  la navegación siga funcionando sin wildcard DNS.

## Tema, modo y `/panel-admin`

- `app/lib/theme-head.ts`: `renderThemeBootstrap` valida tema/modo/color y
  `renderThemeCss`/`renderFontFaceCss` producen el CSS que el root inyecta en el
  `<head>` **después** del CSS de Tailwind y antes de cualquier contenido.
  Tema o color inválido en D1 → 500 + log; nunca un tema por defecto.
- `<html data-theme="…" data-color-mode="…">`; las fuentes del tema activo se
  precargan y el `@font-face` solo incluye sus dos familias (una en Urban Slate).
- `/panel-admin` usa `renderAdminCss({ surface: "panel-admin", primaryColor })`
  y `<html data-surface="panel-admin">`, sin fuentes decorativas.
- Modo oscuro: cookie host-only `color_mode` (sin `Domain`), leída en el loader.
  El POST de `/color-mode` responde 303 con `Set-Cookie`; el HTML siguiente ya
  sale en el modo correcto (sin FOUC ni `useEffect`).
- Fuentes: copia de `packages/themes/fonts` en `public/fonts` (ver su README).

## Datos y errores

- Todo dato viene de `packages/api-client` en loaders/actions/resource routes.
  El navegador nunca llama al API.
- Sin configuración (`ENVIRONMENT`, `APP_DOMAIN`, `API`/`API_INTERNAL_URL`) →
  503 + log; fallo del API → 502; validación propia → 400.
- `packages/api-client` transporta HTML ya formateado (precios) para no cargar
  Zod en el cliente.
- `?category=` inexistente devuelve `404 CATEGORY_NOT_FOUND` en el API; la home
  lo muestra como estado vacío (200) para no romper el catálogo.

## Entorno local

`wrangler.jsonc` (local): `ENVIRONMENT=local`, `APP_DOMAIN=localhost`,
`API_INTERNAL_URL=http://127.0.0.1:9797`, `MEDIA_BASE_URL=http://127.0.0.1:9797/media`.
`.dev.vars` replica esos valores.

```bash
pnpm dev:api          # API en 127.0.0.1:9797
pnpm dev:web          # web en http://localhost:5173
pnpm --filter @tucatalogo/web test
pnpm --filter @tucatalogo/web typecheck
pnpm --filter @tucatalogo/web build
```

- Tienda: `http://{slug}.localhost:5173` o `http://localhost:5173/?siteId={slug}`.
- Sin tienda, el host devuelve 404 controlado (no 500). `/health` responde 200.
- Para QA visual no hay datos mock en el código: la tienda se crea con el flujo
  real (`/auth/store/signup/otp` → OTP en el log del API con
  `EMAIL_DRIVER=console` → `/auth/store/signup`), se inicia sesión con
  `/auth/store/login` + `x-store-slug` y el contenido se sube por `/panel/*`.
