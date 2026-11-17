# Deploy y entornos

Cómo se despliega TuCatálogo en Cloudflare. **Nada de esto se ha ejecutado desde
este repositorio**: no hay credenciales ni recursos creados. Los IDs y hosts de
`env.dev` son placeholders `REPLACE_ME_*`.

Regla del proyecto: `wrangler deploy`, las migraciones remotas y los cambios de
DNS requieren confirmación explícita del owner. No se despliega desde local.

**Modelo actual: prod-only.** El repo no tiene entorno de dev automatizado ni
GitHub Environments. El único deploy es a `env.prod`, disparado automáticamente
por cada push a `master`/`main` (y a mano con `workflow_dispatch`), sin
aprobaciones. `env.dev` sigue existiendo en los `wrangler.jsonc` para un deploy
manual puntual, pero ningún workflow lo despliega.

## Prerrequisitos Cloudflare

| # | Requisito | Detalle |
| --- | --- | --- |
| 1 | Zona `luisrivas.site` activa | Con DNS gestionado por Cloudflare |
| 2 | Comodín `*` **proxied** | Necesario para que `*.luisrivas.site` llegue al worker `web`; la ruta del Worker intercepta el registro |
| 3 | Plan **Workers Paid** | D1, R2 y límites de CPU del diseño (PLAN §18) |
| 4 | Token de API | Permisos de Workers Scripts y Routes (edit), D1 (edit), R2 (edit) y Zone (read); se guarda como repository secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 5 | Resend | Dominio de envío verificado (SPF/DKIM) y API key |
| 6 | Turnstile | Site key y secret key para los hosts del registro |
| 7 | GitHub repo secrets/variable | `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como *repository secrets*, `SMOKE_STORE_HOST` como *repository variable*. Sin Environments ni aprobaciones |
| 8 | `INIT_TOKEN` | Aleatorio (32 bytes = 64 hex en local, dev y prod; valores distintos), guardado como secreto del API |
| 9 | Buzón de pruebas | Para E2E de OTP y reset |

## Recursos por entorno

| Recurso | local | dev | prod |
| --- | --- | --- | --- |
| D1 | `tucatalogo-local` (Miniflare) | `tucatalogo-dev` | `tucatalogo-prod` |
| R2 | `tucatalogo-local` (Miniflare) | `tucatalogo-media-dev` | `tucatalogo-media-prod` |
| Host de media | `http://127.0.0.1:9797/media` | un único valor por entorno | `https://tucatalogo-bucket.luisrivas.site` |

Crear los recursos remotos (desde `apps/api`, que es donde vive `wrangler`):

```bash
cd apps/api
pnpm exec wrangler d1 create tucatalogo-dev
pnpm exec wrangler d1 create tucatalogo-prod
pnpm exec wrangler r2 bucket create tucatalogo-media-dev
pnpm exec wrangler r2 bucket create tucatalogo-media-prod
```

Copia cada `database_id` devuelto a `env.dev` / `env.prod` de
`apps/api/wrangler.jsonc` (sustituye `REPLACE_ME_DEV_D1_DATABASE_ID` y
`REPLACE_ME_PROD_D1_DATABASE_ID`). Los buckets se enlazan por nombre; no hay ID
que copiar.

### Custom domain de R2

En el dashboard: **R2 → bucket `tucatalogo-media-prod` → Settings → Custom
Domains → Connect domain**, con `tucatalogo-bucket.luisrivas.site`. Cloudflare
crea el registro DNS en la zona.

**Gate pendiente:** antes de publicar el bucket hay que comprobar que el wildcard
`*.luisrivas.site` del worker `web` no intercepta
`tucatalogo-bucket.luisrivas.site`. Si lo intercepta, no se publica el bucket
hasta resolverlo: no existe host alternativo ni `cdn.` de reserva
(PLAN §4.2, §12, §17).

Comprobación mínima (cuando exista el recurso):

```bash
curl -sI https://tucatalogo-bucket.luisrivas.site/
# Debe responder R2 (404 de objeto o el objeto pedido), no el 404 del storefront.
```

## Topología de `wrangler.jsonc`

Cada app tiene un `wrangler.jsonc` con:

- **Top-level = local** (`wrangler dev` / `react-router dev`), con `vars` reales
  de local y bindings locales.
- **`env.dev`** y **`env.prod`**: nombres de worker, `vars` y bindings propios.
  Los valores desconocidos son `REPLACE_ME_*`.
- **Rutas solo en `env.prod`**:
  - `web`: `*.luisrivas.site/*` (`zone_name: luisrivas.site`)
  - `commercial`: `tucatalogo.luisrivas.site/*`
  - `console`: `console-tucatalogo.luisrivas.site/*`
  - `api`: **ninguna**; solo service binding
- **Service bindings** `API` en `web`, `commercial` y `console`, apuntando a
  `tucatalogo-api-dev` / `tucatalogo-api-prod`.
- `observability.enabled` y `upload_source_maps` activos en los cuatro workers.
- **Sin hosts accidentales:** `api` con `workers_dev: false` y `preview_urls: false` en todos los entornos; `web`, `commercial` y `console` con `workers_dev: true` solo en `env.dev` (para un deploy manual de dev; ningún workflow lo usa) y `false` en `env.prod`; `preview_urls: false` siempre. El check **A1** (`node packages/config/scripts/check-worker-configs.mjs`) lo valida antes de cada deploy.

`env.dev` no define rutas: se usa `*-dev.workers.dev` y `?siteId` para resolver
la tienda.

## Secretos

Solo el worker `api` tiene secretos. Se cargan por entorno desde `apps/api`; el
deploy automático solo usa `env.prod`:

```bash
cd apps/api
pnpm exec wrangler secret put BETTER_AUTH_SECRET_STORE --env prod
pnpm exec wrangler secret put BETTER_AUTH_SECRET_CONSOLE --env prod
pnpm exec wrangler secret put RESEND_API_KEY --env prod
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env prod
pnpm exec wrangler secret put INIT_TOKEN --env prod
```

Si haces un deploy manual de dev, repite con `--env dev` y valores **distintos**.
`EMAIL_DRIVER`, `TURNSTILE_MODE`, `MEDIA_BASE_URL`, `STORE_ORIGIN_TEMPLATE` y
`CONSOLE_ORIGIN` son variables no secretas y viven en `wrangler.jsonc`. Detalle
completo en [`env.md`](./env.md).

### GitHub repo secrets y variables

Todo se configura una sola vez en **Settings → Secrets and variables → Actions**
del repositorio. No hay Environments.

| Nombre | Tipo | Dónde | Uso |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | *Secrets* | wrangler: migraciones, deploy, status y D1 remoto |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | *Secrets* | idem |
| `SMOKE_STORE_HOST` | Repository variable | *Variables* | host de la tienda de bajo riesgo para el smoke del storefront (`demo.luisrivas.site`) |

El deploy corre automáticamente en cada push a `master`/`main`; no hay pausa por
aprobación. Los secrets nunca se imprimen: solo se inyectan en los steps de
wrangler y smoke. `SMOKE_STORE_HOST` es una **variable** (no secreta) porque el
host aparece en logs; sin ella el smoke falla de forma visible.

> **Antes del primer push de este cambio:** el workflow nuevo se dispara con el
> push. Configura los dos secrets y la variable **antes**, o haz el primer push
> con `[skip ci]` en el mensaje del commit (este repo lo hizo así) y el deploy no
> se ejecutará hasta el siguiente push.

## Orden de deploy

El API va primero: los frontends consumen su contrato.

1. **Migraciones** (prod).
2. **`api`**.
3. **`web`, `commercial` y `console`** (pueden ir en paralelo).
4. **Smoke** de los hosts.

### 1. Migraciones

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply tucatalogo-prod --remote --env prod
```

Reglas (PLAN §13.3): migraciones versionadas en `packages/db/migrations`, nunca se
edita una aplicada, siempre compatibles hacia atrás (expand/contract). `prod` solo
aplica esquema: **sin seeds**. El runner de seeds es local (fija `--local`, usa
`_local_seed_history`) y hoy no hay ningún `*.sql`: no existen datos seed; la
tienda local se crea con el flujo real de registro. El primer admin se crea con
`/init`, no con un seed.

Un fallo de migración detiene el deploy antes del código.

### 2. API

```bash
cd apps/api
pnpm exec wrangler deploy --env prod
```

### 3. Frontends

El plugin de Cloudflare para Vite genera el bundle del worker y un
`.wrangler/deploy/config.json` que apunta al build. El entorno se elige al
**construir** con `CLOUDFLARE_ENV`:

```bash
cd apps/web
CLOUDFLARE_ENV=prod pnpm build
pnpm exec wrangler deploy
```

En PowerShell:

```powershell
$env:CLOUDFLARE_ENV = "prod"
pnpm build
pnpm exec wrangler deploy
```

Repite en `apps/commercial` y `apps/console` con `CLOUDFLARE_ENV=prod`: el
workflow solo construye y despliega `env.prod`.

> **Pendiente cloud:** el flujo build + deploy de los frontends se validará en el
> primer deploy real. El `wrangler.jsonc` de origen y el build generado
> (`apps/*/build/server/wrangler.json`) no declaran las variables de entorno al
> mismo nivel; hay que confirmar que `CLOUDFLARE_ENV` aplica `env.prod` a rutas y
> bindings, como documenta el plugin.

## CI/CD

### Workflows

| Workflow | Disparador | Environments | Despliega |
| --- | --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | push a `main` y PR | — | No |
| [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) | push a `master`/`main` o `workflow_dispatch` | — (repository secrets) | `env.prod` |

- Prod-only: no existe `deploy-dev.yml` y ningún workflow despliega `env.dev`.
- `deploy-prod.yml` comparte `concurrency: group: deploy-cloud` con
  `cancel-in-progress: false`: un deploy en curso no se corta.
- Se dispara con **cada push** a la línea principal, sin aprobación: si el commit
  lleva `[skip ci]` en el mensaje no se ejecuta. Tampoco corre desde PR.
- `pnpm audit --prod --audit-level=high` corre en el workflow: si aparece una
  vulnerabilidad high/critical o la consulta falla, el deploy falla visible.
- `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` son **repository secrets** y se
  inyectan solo en los steps de wrangler/smoke. No se imprimen en ningún log.

Pasos del workflow (prod):

1. checkout → pnpm 10 → Node 22 → `pnpm install --frozen-lockfile`.
2. `node packages/config/scripts/check-worker-configs.mjs` (A1: hosts/rutas).
3. `pnpm audit --prod --audit-level=high` → `pnpm lint` → `pnpm typecheck` →
   `pnpm test` → `pnpm build`.
4. **Migraciones** (`--remote --env prod`) desde `apps/api`. En CI wrangler
   omite la confirmación interactiva; si una migración falla, el deploy se detiene
   antes de tocar código.
5. **Deploy del api** (`wrangler deploy --env prod`).
6. **Frontends**: `CLOUDFLARE_ENV=prod pnpm build` + `wrangler deploy --env
   prod` en `web`, `commercial` y `console`, en ese orden.
7. **Comprobación interna del api**: deployment activo
   (`wrangler deployments status`) y D1 remoto (`d1 execute ... SELECT 1`).
8. **Smoke** de `/health` en los frontends (ver abajo).

El paso 6 es obligatorio: el plugin de Cloudflare fija rutas, bindings y vars del
entorno **al construir**. Desplegar un build local con `--env prod` falla con un
error de `targetEnvironment`; por eso cada app se reconstruye con
`CLOUDFLARE_ENV` justo antes de su deploy.

**Ninguno de estos workflows se ha ejecutado todavía**: no hay credenciales ni
recursos creados en Cloudflare. El commit que introdujo el flujo prod-only viajó
con `[skip ci]` para no desplegar antes de que el owner cree los secrets.

## Smoke

`deploy-prod.yml` comprueba `/health` de los tres frontends con reintentos (12 × 5 s).

| Entorno | web | commercial | console |
| --- | --- | --- | --- |
| prod | `https://<SMOKE_STORE_HOST>/health` | `https://tucatalogo.luisrivas.site/health` | `https://console-tucatalogo.luisrivas.site/health` |

- `env.dev` no tiene smoke automático: su workflow ya no existe.
- En prod el storefront no tiene host fijo (depende del slug), así que el
  workflow exige la repository variable `SMOKE_STORE_HOST` (p. ej.
  `demo.luisrivas.site`, una tienda de bajo riesgo). Si falta, el step falla de
  forma visible.
- `/health` de cada frontend valida `ENVIRONMENT` y `APP_DOMAIN` (200 o 503).
- El `<subdominio>` workers.dev que usaba el smoke de dev ya no se consulta: el
  workflow no llama a la API de Cloudflare para descubrirlo.

### API

El API no tiene host público (A1): no existe URL para `curl` y no hay endpoint
interno expuesto. El workflow verifica:

```bash
cd apps/api
pnpm exec wrangler deployments status --name tucatalogo-api-prod --env prod
pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod --yes \
  --command "SELECT 1 AS ok"
```

Es decir, deployment activo + D1 remoto accesible (las dos dependencias que valida
`/health`). La ruta `/health` del API se ejercita en los tests de integración
(`apps/api/test`) y en local. Un smoke real **por service binding** requiere una
ruta de smoke en un frontend que llame al API; hoy no existe y añadirla es trabajo
de F7 de las apps, no de infraestructura.

Además, tras el deploy conviene comprobar (manual, sin acciones destructivas):

```bash
curl -s https://tucatalogo.luisrivas.site/ | head
curl -sI "https://<tienda-de-prueba>.luisrivas.site/"
```

- El storefront debe devolver HTML de la tienda; una tienda inexistente,
  suspendida o eliminada devuelve 404 idéntico.
- Login del console sin ejecutar acciones destructivas.

## Rollback

**Código:**

```bash
cd apps/api
pnpm exec wrangler rollback tucatalogo-api-prod
```

El mismo comando con `tucatalogo-web-prod`, `tucatalogo-commercial-prod` y
`tucatalogo-console-prod`. Orden: primero los frontends y después el API si el
problema es de contrato; al revés si el contrato nuevo rompe a los clientes
antiguos. Cada release debe convivir con la versión anterior al otro lado del
binding durante la ventana de deploy.

**Datos (D1 Time Travel):**

```bash
cd apps/api
pnpm exec wrangler d1 time-travel info tucatalogo-prod
pnpm exec wrangler d1 time-travel restore tucatalogo-prod --timestamp 2026-11-17T08:00:00.000Z
```

Time Travel restaura D1, **no R2**. Un borrado de tienda es definitivo; por eso la
confirmación exige el slug exacto y R2 se borra antes que D1 (si R2 falla, se
aborta con 502 y D1 queda intacto).

## Paso a `tucatalogo.com` (solo configuración)

El dominio es un parámetro de configuración; no hay cambios de código previstos.
Al migrar:

1. Zona `tucatalogo.com` activa, comodín `*` proxied.
2. Rutas de Worker: wildcard para `web` y hosts exactos para `commercial` y
   `console`, con los mismos patrones que hoy pero en la zona nueva. Los nombres
   concretos se deciden al migrar.
3. `APP_DOMAIN` (`luisrivas.site` → `tucatalogo.com`) en los cuatro workers.
4. `STORE_ORIGIN_TEMPLATE`, `CONSOLE_ORIGIN` y `MEDIA_BASE_URL` en el API.
5. `PROD_HOSTS` y `PROD_REDIRECT_HOSTS` de `packages/shared/src/constants/hosts.ts`
   y la lista de slugs reservados (`tucatalogo-bucket` cambia de nombre).
6. Custom domain del bucket de R2 y Redirect Rules del ápice y `www`.
7. Resend (dominio de envío) y Turnstile (hostnames del widget).
8. Documentación y smoke de los hosts nuevos.

Las cookies son host-only y no llevan `Domain`: no hay migración de sesiones, solo
se vuelve a iniciar sesión en el host nuevo.

## Pendiente cloud

- **Workflows creados pero nunca ejecutados**: no hay credenciales ni recursos.
- Repository secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, y
  repository variable `SMOKE_STORE_HOST`. Sin Environments ni aprobaciones.
- Worker secrets del api (dev/prod, valores distintos): `BETTER_AUTH_SECRET_STORE`,
  `BETTER_AUTH_SECRET_CONSOLE`, `INIT_TOKEN`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`.
- IDs reales de D1 (`REPLACE_ME_DEV_D1_DATABASE_ID` /
  `REPLACE_ME_PROD_D1_DATABASE_ID`) y hosts de `env.dev`.
- Gate wildcard vs custom domain de R2.
- `TURNSTILE_SITE_KEY` en `env.dev`/`env.prod` de `commercial`.
- Primer deploy real de los frontends con `CLOUDFLARE_ENV` (validar que rutas,
  bindings y vars del entorno llegan al build generado).
- Smoke real del API por service binding: requiere una ruta de smoke en un
  frontend (hoy no existe; el workflow comprueba deployment + D1).
- Turnstile, Resend y Lighthouse/axe contra prod.
