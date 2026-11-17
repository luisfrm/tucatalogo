# Deploy y entornos

Cómo se despliega TuCatálogo en Cloudflare. **Los recursos de prod ya existen**
(zona, D1 `tucatalogo-prod`, R2 `tucatalogo-media-prod` y el GitHub Environment
`prod`); los workflows se ejecutan desde GitHub, nunca desde local. Los valores de
`env.dev` siguen siendo placeholders `REPLACE_ME_*` porque dev no se usa.

Regla del proyecto: `wrangler deploy`, las migraciones remotas y los cambios de
DNS requieren confirmación explícita del owner. No se despliega desde local.

**Modelo actual: prod-only.** El repo no tiene entorno de dev automatizado. El único
deploy es a `env.prod`, disparado automáticamente por cada push a `master`/`main`
(y a mano con `workflow_dispatch`). Los dos workflows de prod usan el **GitHub
Environment `prod`**, que **no tiene reglas de protección ni aprobaciones**: agrupa
los secretos y variables del destino, no añade un paso humano. `env.dev` sigue
existiendo en los `wrangler.jsonc` para un deploy manual puntual, pero ningún
workflow lo despliega. Los secretos del worker no viajan con el deploy: se aplican
a mano con el workflow `sync-secrets`.

> **`prod` × 2.** `--env prod` es el entorno de **Wrangler** (`env.prod` del
> `wrangler.jsonc`); `environment: prod` es el **GitHub Environment** del que se
> leen los 5 runtime secrets, `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST`.

## Prerrequisitos Cloudflare

| # | Requisito | Detalle |
| --- | --- | --- |
| 1 | Zona `luisrivas.site` activa | Con DNS gestionado por Cloudflare |
| 2 | Comodín `*` **proxied** | Necesario para que `*.luisrivas.site` llegue al worker `web`; la ruta del Worker intercepta el registro |
| 3 | Plan **Workers Paid** | D1, R2 y límites de CPU del diseño (PLAN §18) |
| 4 | Token de API | Permisos de Workers Scripts y Routes (edit), D1 (edit), R2 (edit) y Zone (read); se guarda como repository secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 5 | Resend | Dominio de envío verificado (SPF/DKIM) y API key |
| 6 | Turnstile | Site key y secret key para los hosts del registro |
| 7 | GitHub: Environment `prod` + 2 repo secrets | **Repository secrets**: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (los usan todos los jobs con Environment). **Environment secrets** (`prod`): los 5 runtime secrets del api (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `INIT_TOKEN`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`). **Environment variables** (`prod`): `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST` (esta última cae en `demo.luisrivas.site` si falta). El Environment `prod` no tiene reglas de protección ni revisores |
| 8 | `INIT_TOKEN` | Aleatorio (32 bytes = 64 hex en local, dev y prod; valores distintos), guardado como Environment secret de `prod` y aplicado al worker con `sync-secrets` |
| 9 | Buzón de pruebas | Para E2E de OTP y reset |

## Recursos por entorno

| Recurso | local | dev | prod |
| --- | --- | --- | --- |
| D1 | `tucatalogo-local` (Miniflare) | `tucatalogo-dev` (no creado) | `tucatalogo-prod` = `ed32bca0-2ed9-4a07-97e5-018e8a15049f` (ENAM) |
| R2 | `tucatalogo-local` (Miniflare) | `tucatalogo-media-dev` (no creado) | `tucatalogo-media-prod` (Standard) |
| Host de media | `http://127.0.0.1:9797/media` | un único valor por entorno | `https://tucatalogo-bucket.luisrivas.site` (custom domain **pendiente**) |

Los recursos de prod ya están creados y `env.prod` de `apps/api/wrangler.jsonc` ya
lleva el `database_id` real. Para un entorno nuevo o un reemplazo (desde
`apps/api`, que es donde vive `wrangler`):

```bash
cd apps/api
pnpm exec wrangler d1 create tucatalogo-prod
pnpm exec wrangler d1 create tucatalogo-dev
pnpm exec wrangler r2 bucket create tucatalogo-media-prod
pnpm exec wrangler r2 bucket create tucatalogo-media-dev
```

Copia el `database_id` devuelto a `env.prod.d1_databases[0].database_id` (o a
`REPLACE_ME_DEV_D1_DATABASE_ID` en dev) de `apps/api/wrangler.jsonc`. Los buckets se
enlazan por nombre; no hay ID que copiar.

### Custom domain de R2

Estado: **pendiente.** El bucket `tucatalogo-media-prod` existe, pero
`tucatalogo-bucket.luisrivas.site` todavía **no tiene registro DNS** (verificado:
sin respuesta y `wrangler r2 bucket domain list tucatalogo-media-prod` devuelve
"no custom domains"). Hasta que el owner lo conecte, `MEDIA_BASE_URL` apunta a un
host que no resuelve y las imágenes no se sirven.

Conectarlo (dos vías equivalentes; ambas crean el DNS en la zona):

```bash
cd apps/api
pnpm exec wrangler r2 bucket domain add tucatalogo-media-prod \
  --domain tucatalogo-bucket.luisrivas.site --zone-id <ZONE_ID> --min-tls 1.2
pnpm exec wrangler r2 bucket domain list tucatalogo-media-prod
```

o en el dashboard: **R2 → bucket `tucatalogo-media-prod` → Settings → Custom
Domains → Connect domain**, con `tucatalogo-bucket.luisrivas.site`.

**Gate F0 (sin verificar todavía):** antes de publicar el bucket hay que comprobar
que el wildcard `*.luisrivas.site` del worker `web` no intercepta
`tucatalogo-bucket.luisrivas.site`. Si lo intercepta, no se publica el bucket y se
documenta el bloqueo: no existe host alternativo ni `cdn.` de reserva
(PLAN §4.2, §12, §17). Hoy el gate **no se puede comprobar** porque el hostname no
existe; se valida en el mismo momento en que se crea el custom domain.

Comprobación (cuando exista el recurso):

```bash
curl -sI https://tucatalogo-bucket.luisrivas.site/
# Debe responder R2 (404 de objeto o el objeto pedido), no el 404 del storefront.
```

El título de la respuesta delata el origen: un `404` con el HTML del storefront
significa que el wildcard ganó y el bucket no es alcanzable.

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

Solo el worker `api` tiene secretos (5). **`wrangler deploy` no los aplica**: el
deploy publica código, variables y bindings, y deja intactos los secretos ya
cargados en el worker. Por eso los secretos no forman parte de `deploy-prod.yml`.

En prod se aplican con un workflow **manual**, `sync-secrets.yml`, que corre con
`environment: prod`, lee los **Environment secrets** de ese Environment y ejecuta
`wrangler secret put --env prod` para cada uno:

1. *Actions → Sync worker secrets → Run workflow*.
2. `target: prod`, `confirm: sync` (sin `sync` exacto el job no corre).
3. El workflow falla si un Environment secret falta o llega vacío, y no escribe
   ningún valor en el log.

Manualmente, el equivalente es:

```bash
cd apps/api
pnpm exec wrangler secret put BETTER_AUTH_SECRET_STORE --env prod
pnpm exec wrangler secret put BETTER_AUTH_SECRET_CONSOLE --env prod
pnpm exec wrangler secret put RESEND_API_KEY --env prod
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env prod
pnpm exec wrangler secret put INIT_TOKEN --env prod
```

En el primer despliegue hay que desplegar el `api` **antes** de sincronizar los
secretos: `wrangler secret put` necesita que el worker exista. Después, para
rotar un secreto basta con repetir el workflow; el siguiente deploy no lo borra.

Si haces un deploy manual de dev, repite con `--env dev` y valores **distintos**
(no hay workflow para dev). `EMAIL_DRIVER`, `TURNSTILE_MODE`, `MEDIA_BASE_URL`,
`STORE_ORIGIN_TEMPLATE` y `CONSOLE_ORIGIN` son variables no secretas y viven en
`wrangler.jsonc`. La site key de Turnstile también: es pública y está en
`env.prod` de `apps/commercial/wrangler.jsonc`. Detalle completo en
[`env.md`](./env.md).

### GitHub Environment, secrets y variables

**Dos niveles, a propósito:**

- **Repository secrets** (`Settings → Secrets and variables → Actions → Secrets`):
  las 2 credenciales de Cloudflare. Disponibles para cualquier job, con
  Environment o sin él.
- **GitHub Environment `prod`** (`Settings → Environments → prod`): los 5 runtime
  secrets del api y las variables del destino prod. **Sin reglas de protección ni
  revisores**: `deploy-prod.yml` sigue siendo automático en cada push.

| Nombre | Tipo | Dónde | Uso |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | *Actions → Secrets* | wrangler: migraciones, deploy, status, D1 remoto y `secret put` |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | *Actions → Secrets* | idem |
| `BETTER_AUTH_SECRET_STORE` | Environment secret (`prod`) | *Environments → prod → Environment secrets* | Runtime secret del api; lo aplica `sync-secrets` |
| `BETTER_AUTH_SECRET_CONSOLE` | Environment secret (`prod`) | idem | idem (valor distinto de `_STORE`) |
| `INIT_TOKEN` | Environment secret (`prod`) | idem | idem; 32 bytes / 64 hex |
| `RESEND_API_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SECRET_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SITE_KEY` | Environment variable (`prod`) | *Environments → prod → Environment variables* | `0x4AAAAAAAGF7HGDtrRDDGsww`. Valor canónico en `env.prod` de `apps/commercial/wrangler.jsonc`; la variable de GitHub es una copia informativa y no se inyecta en el build |
| `SMOKE_STORE_HOST` | Environment variable (`prod`) o Repository variable | *Variables* | host de la tienda de bajo riesgo para el smoke del storefront, sin esquema ni ruta |

El deploy corre automáticamente en cada push a `master`/`main`; no hay pausa por
aprobación. Los secrets nunca se imprimen: se inyectan en los steps de wrangler,
en `sync-secrets` y en el smoke. `SMOKE_STORE_HOST` es una **variable** (no
secreta) porque el host aparece en logs.

`SMOKE_STORE_HOST` tiene un **fallback de CI**, no de runtime: si la variable no
existe, `deploy-prod.yml` usa `demo.luisrivas.site` para no romper el deploy por un
host de smoke. En cuanto el owner tenga una tienda real de bajo riesgo, debe crear
la variable en `prod` (o a nivel de repo): el fallback apunta a un host que solo es
válido mientras exista esa tienda.

> **Al primer push con este modelo:** el deploy se dispara solo. Los 2 secrets de
> Cloudflare, los 5 Environment secrets y las variables ya están creados, así que
> el deploy corre; `sync-secrets` sigue siendo manual y **debe lanzarse después**
> del primer deploy exitoso del `api` (el worker tiene que existir para recibir
> `wrangler secret put`).

## Orden de deploy

El API va primero: los frontends consumen su contrato.

1. **Migraciones** (prod).
2. **`api`**.
3. **`web`, `commercial` y `console`** (pueden ir en paralelo).
4. **Smoke** de los hosts.

Los secretos van **fuera** de ese orden porque no son parte del deploy: el primer
día, después del deploy inicial del `api`, se lanza una vez el workflow manual
`sync-secrets`; en rotaciones se relanza cuando toque. En cada push posterior el
deploy no toca los secretos y no los borra.

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

| Workflow | Disparador | Environment | Despliega |
| --- | --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | push a `main` y PR | — | No |
| [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) | push a `master`/`main` o `workflow_dispatch` | `prod` (+ 2 repository secrets de Cloudflare) | `env.prod` |
| [`sync-secrets.yml`](../.github/workflows/sync-secrets.yml) | **solo `workflow_dispatch`** (`target: prod`, `confirm: sync`) | `prod` | No despliega: `wrangler secret put --env prod` de los 5 secretos del api |

- Prod-only: no existe `deploy-dev.yml` y ningún workflow despliega `env.dev`. El
  Environment `dev` existe en GitHub pero **no se usa**.
- El Environment `prod` no tiene reglas de protección ni aprobaciones: agrupa
  secretos y variables, no bloquea el deploy.
- `deploy-prod.yml` es **solo deploy**: no sincroniza secretos (ver arriba). El
  sync no está duplicado en el deploy.
- `sync-secrets.yml` es manual por diseño y exige escribir `sync` en `confirm`;
  sin eso el job no corre. Falla si un Environment secret falta o está vacío y no
  imprime valores.
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

Los secretos **no** están en esa lista: `wrangler deploy` no los aplica y
`sync-secrets.yml` es manual. Tras el primer deploy exitoso del `api` se lanza una
vez (`target: prod`, `confirm: sync`).

El paso 6 es obligatorio: el plugin de Cloudflare fija rutas, bindings y vars del
entorno **al construir**. Desplegar un build local con `--env prod` falla con un
error de `targetEnvironment`; por eso cada app se reconstruye con
`CLOUDFLARE_ENV` justo antes de su deploy.

**Ninguno de estos workflows se ha ejecutado todavía** en la versión actual: el
primer push de este cambio es el que estrena el Environment `prod` en CI.

## Smoke

`deploy-prod.yml` comprueba `/health` de los tres frontends con reintentos (12 × 5 s).

| Entorno | web | commercial | console |
| --- | --- | --- | --- |
| prod | `https://<SMOKE_STORE_HOST>/health` | `https://tucatalogo.luisrivas.site/health` | `https://console-tucatalogo.luisrivas.site/health` |

- `env.dev` no tiene smoke automático: su workflow ya no existe.
- En prod el storefront no tiene host fijo (depende del slug), así que el
  workflow lee la variable `SMOKE_STORE_HOST` (p. ej. `demo.luisrivas.site`, una
  tienda de bajo riesgo). Si la variable no existe, cae en `demo.luisrivas.site`
  para no romper el deploy; el owner debe crearla cuando tenga una tienda real.
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

- **Workflows sin ejecutar**: `ci.yml`, `deploy-prod.yml` y `sync-secrets.yml`
  existen, pero la primera ejecución real de prod es la del primer push.
- **Hecho en Cloudflare:** zona `luisrivas.site`, D1 `tucatalogo-prod`
  (`ed32bca0-2ed9-4a07-97e5-018e8a15049f`, ENAM) y R2 `tucatalogo-media-prod`.
- **Pendiente en Cloudflare:**
  - Custom domain `tucatalogo-bucket.luisrivas.site` del bucket de prod y, con él,
    el **gate wildcard vs bucket** (F0). Sin DNS el host no resuelve.
  - Turnstile: confirmar que los hostnames del widget incluyen
    `tucatalogo.luisrivas.site`.
  - Resend: dominio de envío `luisrivas.site` verificado (SPF/DKIM) con la API key
    del Environment secret.
  - Redirect Rules 301 del ápice y `www` hacia el commercial.
- **En GitHub:** Environment `prod` creado con los 5 Environment secrets
  (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `INIT_TOKEN`,
  `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`), la variable `TURNSTILE_SITE_KEY` y los
  2 Repository secrets de Cloudflare. Falta `SMOKE_STORE_HOST` como variable: hoy
  se usa el fallback `demo.luisrivas.site`.
- **Secretos del worker api en prod:** se aplican con el workflow manual
  `sync-secrets` (`wrangler secret put --env prod`) **después** del primer deploy
  del api.
- **`env.dev`:** sigue en placeholders (`REPLACE_ME_DEV_*`) y no se usa. Si alguna
  vez se despliega a mano, se aplican secretos con `--env dev` y valores distintos.
- **Primer deploy real de los frontends con `CLOUDFLARE_ENV`** (validar que rutas,
  bindings y vars del entorno llegan al build generado).
- **Smoke real del API por service binding:** requiere una ruta de smoke en un
  frontend (hoy no existe; el workflow comprueba deployment + D1).
- **Lighthouse/axe contra prod.**
