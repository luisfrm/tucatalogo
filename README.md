# TuCatálogo

SaaS multitienda de catálogos (zapatos, maquillaje, sandalias). **Una cuenta = una
tienda**: se publica en `slug.tucatalogo.live`, el dueño la administra en
`/panel-admin` y el pedido llega por WhatsApp.

- **Fuente de verdad del producto:** [`PLAN.md`](./PLAN.md) (v1.1).
- **Contexto operativo de los agentes:** [`AGENTS.md`](./AGENTS.md).
- **Requerimientos v1.0:** `Requerimientos MVP – Plataforma de Catálogos.md`
  (baseline con su nota de vigencia; no se reescribe).

**Estado actual:** F1 (monorepo), F2 (API y auth), F3 (commercial), F4 (storefront
y temas), F5 (`/panel-admin`) y F6 (console) están implementados. `docs/` y los
tres workflows (`ci.yml`, `deploy-prod.yml`, `sync-secrets.yml`) existen. En
Cloudflare ya están provisionados la zona, D1 `tucatalogo-prod` y R2
`tucatalogo-media-prod`, y en GitHub el Environment `prod` con los 5 runtime secrets;
queda el primer deploy y el custom domain del bucket (ver
[`docs/deploy.md`](./docs/deploy.md)).

## Stack

Monorepo **pnpm** · **Cloudflare Workers** (`wrangler.jsonc` con `env.dev` /
`env.prod`) · **Hono** · **D1 + Drizzle** · **R2** · **React Router v8** (framework
mode) · **better-auth** · **Resend** · **Zod** en `packages/types` · **Radix + CVA
+ Tailwind v4**.

Versiones fijadas: Node `>=22.22.0 <25`, pnpm `10.34.9`, `react-router@8.5.1`,
`hono@4.13.19`, `better-auth@1.7.25`, `wrangler@4.163.0`, `vitest@4.1.12`.

## Arquitectura

Cuatro workers y siete paquetes. La API no tiene ruta pública: los frontends solo
la alcanzan por service binding (o por `API_INTERNAL_URL` en local) a través de
`packages/api-client`.

### Workers

| App | Prod | Dev | Local (`pnpm dev`) | Rol |
| --- | --- | --- | --- | --- |
| `apps/api` | `tucatalogo-api-prod` (sin ruta) | `tucatalogo-api-dev` (sin ruta) | `http://127.0.0.1:9797` | Hono. Único con bindings D1 y R2 |
| `apps/web` | `*.tucatalogo.live` | `tucatalogo-web-dev` + `?siteId` | `http://localhost:5173` | Storefront por subdominio **y** `/panel-admin` |
| `apps/commercial` | `tucatalogo.live` | `tucatalogo-commercial-dev` | `http://localhost:5174` | Landing y registro multipaso |
| `apps/console` | `console.tucatalogo.live` | `tucatalogo-console-dev` | `http://localhost:5175` | Backoffice SaaS: tiendas, suspensión, borrado, auditoría |

El ápice y `www` redirigen 301 al commercial con Redirect Rules (fuera de
Workers). El bucket de R2 se sirve en `bucket.tucatalogo.live`.

### Paquetes

| Paquete | Rol |
| --- | --- |
| `packages/db` | Esquema Drizzle, migraciones versionadas y seeds locales |
| `packages/types` | Schemas Zod y tipos derivados (contratos) |
| `packages/shared` | Constantes y utilidades usadas por 2+ apps (slugs reservados, hosts, monedas) |
| `packages/api-client` | Cliente Hono RPC + adapter (service binding / localhost) + funciones de dominio |
| `packages/themes` | Tokens de los 5 temas, fuentes self-hosted, motor OKLCH e injector SSR |
| `packages/ui` | Componentes globales Radix + CVA |
| `packages/config` | `tsconfig`, ESLint y preset de Tailwind v4 |

### Bindings

```
commercial ─┐
web ────────┼─ service binding `API` ──▶ api ──┬─ D1 (`DB`)
console ────┘                                  └─ R2 (`MEDIA_BUCKET`)
```

En local no hay binding: `packages/api-client` usa
`API_INTERNAL_URL=http://127.0.0.1:9797`. Si no hay binding ni URL, la app
responde 503 con log; nunca se crea un cliente vacío.

### Rutas

| Superficie | Rutas implementadas |
| --- | --- |
| Commercial | `/`, `/registro`, `/registro/slug-check`, `/terminos`, `/privacidad`, `/health` |
| Web | `/`, `/producto/:slug`, `/color-mode` (POST), `/sitemap.xml`, `/robots.txt`, `/health`, y el panel: `/panel-admin` (dashboard), `/panel-admin/login`, `/panel-admin/recuperar`, `/panel-admin/reset-password` + alias `/panel-admin/restablecer`, `/panel-admin/logout`, `/panel-admin/productos`, `/panel-admin/productos/nuevo`, `/panel-admin/productos/:id`, `/panel-admin/categorias`, `/panel-admin/hero`, `/panel-admin/settings`, `/panel-admin/eliminada` |
| Console | `/init`, `/login`, `/2fa`, `/recuperar`, `/restablecer` (alias `/reset-password`), `/logout`, `/` (tiendas), `/tiendas/:id`, `/auditoria`, `/health` |
| API | `/`, `/health`, `/auth/store/*`, `/auth/console/*`, `/public/:slug/*`, `/panel/*`, `/console/*`, `/media/*` y, solo local, `/dev/outbox*` |

El contrato detallado del API está en
[`apps/api/src/routes/README.md`](./apps/api/src/routes/README.md) y
[`apps/api/src/auth/README.md`](./apps/api/src/auth/README.md).

## Requisitos

- **Node 22.22+** y menor que 25 (`engines` de `package.json`). El entorno local
  verificado usa Node 24.15.0.
- **pnpm 10** (`packageManager: pnpm@10.34.9`). Si no lo tienes: `corepack enable`.
- **Ninguna credencial de Cloudflare** para desarrollar en local.
- **Workers Paid** solo para desplegar a `dev`/`prod` (D1, R2 y límites de CPU).

## Setup local

1. Instala dependencias:

   ```bash
   pnpm install
   ```

2. Crea los `.dev.vars` (están gitignored). Cada app trae su ejemplo:

   ```bash
   cp apps/api/.dev.vars.example apps/api/.dev.vars
   cp apps/web/.dev.vars.example apps/web/.dev.vars
   cp apps/commercial/.dev.vars.example apps/commercial/.dev.vars
   cp apps/console/.dev.vars.example apps/console/.dev.vars
   ```

   En PowerShell: `Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars`
   (repite con las otras tres apps).

3. Genera los secretos locales. **Solo** `apps/api/.dev.vars` los lleva; el
   ejemplo los deja vacíos a propósito:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # BETTER_AUTH_SECRET_STORE
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # BETTER_AUTH_SECRET_CONSOLE
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # INIT_TOKEN (local: 32 bytes / 64 hex)
   ```

   El valor local de `INIT_TOKEN` que usa el repo es
   `22f305ec398dd3b1f6e629a4724e59276ee8c5fdf7aec58a6b28c18307d4e4a8`
   (32 bytes / 64 hex). No es un secreto de prod: dev y prod llevan valores
   propios y distintos. Los demás valores locales no sensibles (puertos,
   `MEDIA_BASE_URL`, claves de prueba de Turnstile) ya vienen en el ejemplo y en
   el `vars` de cada `wrangler.jsonc`; el detalle está en
   [`docs/env.md`](./docs/env.md).

4. Aplica las migraciones a la D1 local:

   ```bash
   pnpm db:migrate:local
   ```

   Equivale a `wrangler d1 migrations apply tucatalogo-local --local` con el
   `wrangler.jsonc` de `apps/api`. Hoy hay dos migraciones (`0000`, `0001`).

5. Aplica los seeds locales (hoy no hay ningún `*.sql`: no existen datos seed; la
   primera tienda se crea con el flujo real de registro):

   ```bash
   pnpm db:seed:local
   ```

6. Arranca los cuatro workers:

   ```bash
   pnpm dev
   ```

   O por separado: `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:commercial`,
   `pnpm dev:console`. Los cuatro conviven porque los puertos de cada app y los de
   inspector están fijados (web `9233`, commercial `9234`, console `9235`).

### URLs locales

| App | URL | Puerto |
| --- | --- | --- |
| `apps/api` | `http://127.0.0.1:9797` | 9797 |
| `apps/web` | `http://localhost:5173` | 5173 |
| `apps/commercial` | `http://localhost:5174` | 5174 |
| `apps/console` | `http://localhost:5175` | 5175 |

`MEDIA_BASE_URL` local es `http://127.0.0.1:9797/media`: el API sirve los objetos
de R2 bajo `stores/` solo en `local`/`development`; en prod esa ruta responde
404 y las imágenes salen del custom domain del bucket.

### Probar subdominios en local

El worker web resuelve la tienda desde el `Host` (`APP_DOMAIN=localhost`):

```text
http://demo.localhost:5173            # slug "demo"
http://localhost:5173/?siteId=demo    # misma tienda, sin DNS wildcard
```

Los navegadores modernos resuelven `*.localhost` sin tocar el archivo de hosts.
Si el tuyo no lo hace, usa `?siteId`. Ese parámetro **solo** se acepta con
`ENVIRONMENT=local` o `development`; en producción responde 400 + log y nunca
sustituye la comprobación de propiedad de la tienda.

### Correo local y outbox

Con `EMAIL_DRIVER=memory` (valor del `.dev.vars.example`) el API guarda el último
correo de cada destinatario en memoria y lo expone **solo en local**:

```bash
curl "http://127.0.0.1:9797/dev/outbox?to=duena@example.com"
curl "http://127.0.0.1:9797/dev/outbox/last"
```

La respuesta incluye `code` (OTP) o `resetUrl` (enlace de recuperación) y
`Cache-Control: no-store`. Fuera de `local`, o con otro driver, la ruta responde
404. Alternativa: `EMAIL_DRIVER=console` imprime el OTP y el enlace en el log de
`wrangler dev`.

### Crear la primera tienda

1. Abre `http://localhost:5174/registro`.
2. Completa los cuatro pasos: datos (email, contraseña, nombre, slug y moneda),
   tema, verificación por OTP y confirmación. El slug se valida en vivo contra
   `GET /auth/store/slug-check`.
3. En el paso de OTP, lee el código con
   `curl "http://127.0.0.1:9797/dev/outbox?to=<email>"` (o en el log si usas
   `EMAIL_DRIVER=console`). El OTP dura 10 minutos, admite 5 intentos y el
   reenvío espera 60 s.
4. Al confirmar se crean la cuenta y la tienda con `status = active`.
   El storefront queda en `http://<slug>.localhost:5173`.

El login de tienda existe en el API (`POST /auth/store/login` con la cabecera
`x-store-slug`) y la pantalla está en `/panel-admin/login`; el panel completo
(productos, categorías, hero y settings) está implementado en `apps/web`.

### Crear el primer administrador del console

1. Arranca el console (`pnpm dev:console`) y abre `http://localhost:5175/init`.
2. Pega el `INIT_TOKEN` de `apps/api/.dev.vars` y elige email y contraseña. El
   console reenvía el token al API por service binding y no lo almacena.
3. Guarda la **URI TOTP** y los **códigos de respaldo**: se muestran una sola
   vez. El console **no abre sesión** en este paso: continúa a `/2fa`, enrola la
   app autenticadora y verifica un código. La cookie `console.session_token` solo
   se emite al verificar (`/auth/console/2fa/verify`), y hasta entonces
   `admin_two_factor.verified` es 0 y `/console/*` responde 403.
4. A partir de ahí `/init` responde **410 Gone** exista o no un token válido. El
   `enrollmentToken` del alta es de un solo uso y caduca a los 10 minutos.

La recuperación de contraseña del console usa `/recuperar`; el enlace del correo
apunta a `/reset-password?token=…`, que redirige a `/restablecer?token=…`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Los cuatro workers con `concurrently` |
| `pnpm build` | `pnpm -r build`: `tsc --noEmit` en el API y build de React Router + Vite en las tres apps web |
| `pnpm lint` | ESLint 10 con la flat config de `packages/config` |
| `pnpm typecheck` | `tsc` por paquete; en frontends antes corre `wrangler types` y `react-router typegen` |
| `pnpm test` | Vitest en los paquetes que definen `test` |
| `pnpm test:e2e` | Playwright E2E del MVP (crea una tienda desechable y la borra) |
| `pnpm db:migrate:local` | Migraciones D1 locales (`tucatalogo-local`) |
| `pnpm db:seed:local` | Seeds SQL locales idempotentes (`-- --force` para reaplicar) |

Filtra por paquete cuando trabajes en uno solo:

```bash
pnpm --filter @tucatalogo/api test
pnpm --filter @tucatalogo/web typecheck
```

Tests: Vitest 4.1. El API corre dentro del runtime de Workers con
`@cloudflare/vitest-plugin` 1.8.3 (sucesor de `@cloudflare/vitest-pool-workers`,
ver [`docs/adr/0001-f0-stack-decisions.md`](./docs/adr/0001-f0-stack-decisions.md)),
con D1/R2 locales y migraciones inyectadas; no depende de `.dev.vars` ni de la
red. `packages/db` genera migraciones con
`pnpm --filter @tucatalogo/db generate`.

### E2E (Playwright)

`pnpm test:e2e` recorre el MVP completo contra los cuatro workers locales
(`pnpm dev`, que Playwright arranca o reutiliza). Requiere los `.dev.vars`
locales y la D1 con migraciones.

| Proyecto | Qué verifica |
| --- | --- |
| `setup` | Registro real por UI de una tienda desechable `e2e-<timestamp>` y de `qa-store` si falta |
| `panel` | Login, categoría, 10 productos, imágenes (WebP normalizado en el navegador), 2 slides de hero, tema/color/moneda/WhatsApp, suspensión del dueño y reset de contraseña |
| `storefront` | Home, ficha, modo oscuro por cookie, SEO y 404 (inexistente, reservado, producto inexistente) |
| `isolation` | La sesión de una tienda no lee ni escribe datos de otra (403/404) |
| `axe` | Sin violaciones critical/serious en storefront, ficha, panel autenticado, logins de panel/console y las dos superficies de commercial |
| `console` | `/init` one-time (410 después), 2FA TOTP, backup code, reset de contraseña por email, listado/detalle, suspender con motivo, owner bloqueado, reactivar, aislamiento de reinos y auditoría |
| `console-delete` | Borrado de la tienda desechable con confirmación por slug, audit y cuarentena (deja el estado final) |

Convenciones:

- Los proyectos van encadenados (`dependencies`), pero las dependencias expresan
  **datos**, no salud: `setup` crea la tienda y `panel` su catálogo. Las
  auditorías de axe viven en proyectos de los que nadie depende (`axe` y
  `console`) y el último proyecto (`console-delete`) **borra** la tienda
  desechable. Un fallo de accesibilidad nunca salta el resto de la suite.
- Ningún proyecto usa `mode: "serial"`: los tests comparten estado por
  `e2e/.state` (un solo worker, orden de declaración) y cada uno declara su
  precondición. Si falta, se salta con el motivo en el reporte.
- `qa-store` (`qa-store@example.test` / `QaStore2026!`, en
  `http://qa-store.localhost:5173`) es la tienda de referencia: los E2E **no** la
  borran ni la suspenden de forma permanente.
- Turnstile usa el sitekey de prueba oficial con `TURNSTILE_MODE=test`; el test
  espera el token real del widget y **no** hay bypass.
- El estado de la ejecución queda en `e2e/.state/` (ignorado por git): slug,
  credenciales y secreto TOTP del admin del console. Las credenciales del admin
  viven en `e2e/.state/console-admin.json` para sobrevivir a la reescritura de
  `run.json` de cada pasada.
- `/init` es one-time. Si la D1 local ya tiene un admin, el proyecto `console`
  **no** rellena el formulario: comprueba el 410 y reutiliza el admin de la pasada
  anterior. Solo si el admin se creó fuera del E2E (sin credenciales guardadas)
  hay que vaciar el reino admin una vez, con los servidores parados:

  ```bash
  node e2e/scripts/reset-admin.mjs         # vacía admin_* (nunca store_*)
  node e2e/scripts/reset-local-limits.mjs  # borra rate_limit_counter locales
  ```

  Pasadas consecutivas dentro de la misma ventana de 15 min siguen necesitando
  `reset-local-limits.mjs`: los topes de login del MVP (5 por IP+email) son
  intencionados y el E2E no los toca.

- Tiendas `e2e-*` que hayan quedado de una ejecución fallida:

  ```bash
  node e2e/scripts/cleanup-stores.mjs --dry-run
  node e2e/scripts/cleanup-stores.mjs
  ```

  El script usa el camino real del console (login + 2FA + `DELETE`), así que
  borra R2, D1, `store_users` y deja la cuarentena de slug.

## Documentación

| Documento | Contenido |
| --- | --- |
| [`PLAN.md`](./PLAN.md) | Decisiones, alcance, fases y criterios de aceptación |
| [`AGENTS.md`](./AGENTS.md) | Superficies, reglas no negociables y flujo de trabajo |
| [`docs/env.md`](./docs/env.md) | Variables y secretos por app y entorno |
| [`docs/deploy.md`](./docs/deploy.md) | Cloudflare, D1/R2, orden de deploy, CI, rollback |
| [`docs/runbook.md`](./docs/runbook.md) | Operaciones e incidentes |
| [`docs/adr/0001-f0-stack-decisions.md`](./docs/adr/0001-f0-stack-decisions.md) | Decisiones de stack del spike F0 |

## Pendiente cloud

Recursos de prod ya provisionados (D1 `tucatalogo-prod`, R2
`tucatalogo-media-prod` con custom domain activo, worker `api` desplegado con sus
5 secrets, GitHub Environment `prod`). Lo que falta:

- **DNS de `tucatalogo.live`**: faltan los registros proxied (apex, `*`, `console`,
  `www`) y el custom domain del bucket. Sin ellos todo resuelve NXDOMAIN.
- **Permiso del token**: la zona `tucatalogo.live` debe estar en `CLOUDFLARE_API_TOKEN`
  (`Workers Routes → Edit` + `Zone → Read`). Sin eso no se aplican las rutas de
  `web`, `commercial` ni `console` y el deploy se detiene en `Deploy web`.
- **Gate F0 (wildcard vs bucket): abierto.** Con todo en una sola zona,
  `*.tucatalogo.live` puede casar con `bucket.tucatalogo.live`; hay que revalidar
  con `curl` y, si intercepta, añadir una ruta de negación sin script.
- Hosts de `env.dev` y `REPLACE_ME_DEV_D1_DATABASE_ID`: dev no se usa y sigue en
  placeholders.
- Deploy **prod-only**: `deploy-prod.yml` despliega en cada push a `master`/`main`
  con el GitHub **Environment `prod`** (sin reglas de protección ni aprobaciones).
  Credenciales: 2 **repository secrets** (`CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`); los 5 runtime secrets y las variables
  (`TURNSTILE_SITE_KEY`, `SMOKE_STORE_HOST`) viven en el Environment `prod`.
  `SMOKE_STORE_HOST` cae en `demo.tucatalogo.live` mientras no exista la variable:
  el owner debe crearla cuando tenga una tienda real de bajo riesgo.
- Secretos de runtime del api: los 5 (`BETTER_AUTH_SECRET_STORE`,
  `BETTER_AUTH_SECRET_CONSOLE`, `INIT_TOKEN`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`) son **Environment secrets de `prod`** y se aplican con el
  workflow **manual** `sync-secrets` (`target: prod`, `confirm: sync`), que ejecuta
  `wrangler secret put --env prod`. `wrangler deploy` no aplica secretos. Ojo:
  `--env prod` es de Wrangler, el `environment: prod` es de GitHub. La
  `TURNSTILE_SITE_KEY` de prod es pública y vive en
  `apps/commercial/wrangler.jsonc` (el Environment `prod` guarda una copia
  informativa).
- Turnstile y Resend reales (local usa `test` y `memory`): confirmar hostnames del
  widget y dominio de envío verificado.
- Primer deploy real y Lighthouse/axe formal sobre prod.
