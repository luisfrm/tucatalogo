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
> leen los 4 runtime secrets, `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST`.

## Prerrequisitos Cloudflare

| # | Requisito | Detalle |
| --- | --- | --- |
| 1 | Zona `tucatalogo.live` activa | Con DNS gestionado por Cloudflare. Es el único dominio del proyecto |
| 2 | Registros proxied en `tucatalogo.live` | `@` (commercial), `*` (tiendas), `console` y `www`. El `bucket` lo crea el custom domain de R2 |
| 3 | Plan **Workers Paid** | D1, R2 y límites de CPU del diseño (PLAN §18) |
| 4 | Token de API | Permisos de Workers Scripts y Routes (edit), D1 (edit), R2 (edit) y Zone (read); se guarda como repository secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 5 | Resend | Dominio de envío verificado (SPF/DKIM) y API key |
| 6 | Turnstile | Site key y secret key para los hosts del registro |
| 7 | GitHub: Environment `prod` + 2 repo secrets | **Repository secrets**: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (los usan todos los jobs con Environment). **Environment secrets** (`prod`): los 4 runtime secrets del api (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`). **Environment variables** (`prod`): `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST` (esta última cae en `demo.tucatalogo.live` si falta). El Environment `prod` no tiene reglas de protección ni revisores |
| 8 | **Cloudflare Access** del alta | Aplicación self-hosted en `console.tucatalogo.live` con path `init` y política que solo admite al owner. **Requisito previo** al deploy de la versión sin token: sin ella, `/init` queda abierto. Ver *Cloudflare Access del alta* |
| 9 | Buzón de pruebas | Para E2E de OTP y reset |

## Recursos por entorno

| Recurso | local | dev | prod |
| --- | --- | --- | --- |
| D1 | `tucatalogo-local` (Miniflare) | `tucatalogo-dev` (no creado) | `tucatalogo-prod` = `ed32bca0-2ed9-4a07-97e5-018e8a15049f` (ENAM) |
| R2 | `tucatalogo-local` (Miniflare) | `tucatalogo-media-dev` (no creado) | `tucatalogo-media-prod` (Standard) |
| Host de media | `http://127.0.0.1:9797/media` | un único valor por entorno | `https://bucket.tucatalogo.live` (custom domain activo) |

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

Estado: **creado y sirviendo.** El bucket `tucatalogo-media-prod` tiene conectado
`bucket.tucatalogo.live` (`enabled: Yes`, `ownership_status: active`,
proxied). Verificado con `curl -sSI https://bucket.tucatalogo.live/`:
responde el 404 nativo de R2 (`Content-Type: text/plain`), no el HTML del
storefront.

Conectarlo en un entorno nuevo o recrearlo:

```bash
cd apps/api
pnpm exec wrangler r2 bucket domain add tucatalogo-media-prod \
  --domain bucket.tucatalogo.live \
  --zone-id d5145cb067ce831b7b6d4d416cb810f0 --min-tls 1.2
pnpm exec wrangler r2 bucket domain list tucatalogo-media-prod
```

o en el dashboard: **R2 → bucket `tucatalogo-media-prod` → Settings → Custom
Domains → Connect domain**, con `bucket.tucatalogo.live`.

**Gate F0: abierto.** Todo vive en la misma zona, así que el patrón
`*.tucatalogo.live/*` **sí puede** casar con `bucket.tucatalogo.live` (un solo
label bajo el apex). La precedencia entre una ruta de Worker y un custom domain de
R2 no está garantizada, así que hay que medirla. Si el wildcard intercepta, la
salida es una **ruta de negación** (`bucket.tucatalogo.live/*` sin script, vía
API/dashboard) o mover el bucket a un host fuera del wildcard: nunca un `cdn.` de
reserva.

Comprobación (obligatoria antes de dar el media host por bueno):

```bash
curl -sSI https://bucket.tucatalogo.live/
# Debe responder R2 (404 de objeto o el objeto pedido), no el 404 del storefront.
```

El `Content-Type` delata el origen: `text/plain` es R2; `text/html` es el
storefront y significa que el wildcard ganó.

## Topología de `wrangler.jsonc`

Cada app tiene un `wrangler.jsonc` con:

- **Top-level = local** (`wrangler dev` / `react-router dev`), con `vars` reales
  de local y bindings locales.
- **`env.dev`** y **`env.prod`**: nombres de worker, `vars` y bindings propios.
  Los valores desconocidos son `REPLACE_ME_*`.
- **Rutas solo en `env.prod`**:
  - `web`: `*.tucatalogo.live/*` (`zone_name: tucatalogo.live`)
  - `commercial`: `tucatalogo.live/*` (apex)
  - `console`: `console.tucatalogo.live/*`
  - `api`: **ninguna**; solo service binding
- **Service bindings** `API` en `web`, `commercial` y `console`, apuntando a
  `tucatalogo-api-dev` / `tucatalogo-api-prod`.
- `observability.enabled` y `upload_source_maps` activos en los cuatro workers.
- **Sin hosts accidentales:** `api` con `workers_dev: false` y `preview_urls: false` en todos los entornos; `web`, `commercial` y `console` con `workers_dev: true` solo en `env.dev` (para un deploy manual de dev; ningún workflow lo usa) y `false` en `env.prod`; `preview_urls: false` siempre. El check **A1** (`node packages/config/scripts/check-worker-configs.mjs`) lo valida antes de cada deploy.

`env.dev` no define rutas: se usa `*-dev.workers.dev` y `?siteId` para resolver
la tienda.

## Secretos

Solo el worker `api` tiene secretos (4). **`wrangler deploy` no los aplica**: el
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
```

En el primer despliegue hay que desplegar el `api` **antes** de sincronizar los
secretos: `wrangler secret put` necesita que el worker exista. Después, para
rotar un secreto basta con repetir el workflow; el siguiente deploy no lo borra.

`INIT_TOKEN` ya no es un secreto del worker (ADR 0002). Si quedó de la versión
anterior, bórralo una vez; no se vuelve a crear:

```bash
cd apps/api
pnpm exec wrangler secret delete INIT_TOKEN --env prod
```

y elimina el *Environment secret* homónimo en GitHub. Es limpieza, no un paso de
deploy: ningún código lo lee y `sync-secrets` ya no lo enumera.

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
- **GitHub Environment `prod`** (`Settings → Environments → prod`): los 4 runtime
  secrets del api y las variables del destino prod. **Sin reglas de protección ni
  revisores**: `deploy-prod.yml` sigue siendo automático en cada push.

| Nombre | Tipo | Dónde | Uso |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | *Actions → Secrets* | wrangler: migraciones, deploy, status, D1 remoto y `secret put` |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | *Actions → Secrets* | idem |
| `BETTER_AUTH_SECRET_STORE` | Environment secret (`prod`) | *Environments → prod → Environment secrets* | Runtime secret del api; lo aplica `sync-secrets` |
| `BETTER_AUTH_SECRET_CONSOLE` | Environment secret (`prod`) | idem | idem (valor distinto de `_STORE`) |
| `RESEND_API_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SECRET_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SITE_KEY` | Environment variable (`prod`) | *Environments → prod → Environment variables* | `0x4AAAAAAGF7HGDrrRDDGsww`. Valor canónico en `env.prod` de `apps/commercial/wrangler.jsonc`; la variable de GitHub es una copia informativa y no se inyecta en el build |
| `SMOKE_STORE_HOST` | Environment variable (`prod`) o Repository variable | *Variables* | host de la tienda de bajo riesgo para el smoke del storefront, sin esquema ni ruta |

El deploy corre automáticamente en cada push a `master`/`main`; no hay pausa por
aprobación. Los secrets nunca se imprimen: se inyectan en los steps de wrangler,
en `sync-secrets` y en el smoke. `SMOKE_STORE_HOST` es una **variable** (no
secreta) porque el host aparece en logs.

`SMOKE_STORE_HOST` tiene un **fallback de CI**, no de runtime: si la variable no
existe, `deploy-prod.yml` usa `demo.tucatalogo.live` para no romper el deploy por un
host de smoke. En cuanto el owner tenga una tienda real de bajo riesgo, debe crear
la variable en `prod` (o a nivel de repo): el fallback apunta a un host que solo es
válido mientras exista esa tienda.

> **Al primer push con este modelo:** el deploy se dispara solo. Los 2 secrets de
> Cloudflare, los 4 Environment secrets y las variables ya están creados, así que
> el deploy corre; `sync-secrets` sigue siendo manual y **debe lanzarse después**
> del primer deploy exitoso del `api` (el worker tiene que existir para recibir
> `wrangler secret put`).

## Cloudflare Access del alta (`/init`)

El alta del primer admin ya no usa token: la única barrera es una aplicación de
**Cloudflare Access** (Zero Trust) sobre el path `init` de
`console.tucatalogo.live` (ADR 0002). Es un requisito **previo** al deploy de esta
versión: sin Access, `/init` queda expuesto hasta que exista un admin.

Configuración (dashboard, una vez por entorno con host propio):

1. *Zero Trust → Access → Applications → Add an application → Self-hosted*.
2. **Application domain:** `console.tucatalogo.live`, **path** `init`. No cubre el
   resto del console.
3. **Policy:** `Allow` con *Include → Emails* = el email del owner. Sin reglas
   `Bypass`.
4. **Login method:** el de la organización (One-time PIN por email o un IdP
   configurado). Los accesos quedan registrados en los logs de Access.
5. Sesión corta (por ejemplo 15 min): solo hace falta para completar el alta.

Comprobación obligatoria antes de desplegar:

```bash
curl -sI https://console.tucatalogo.live/init
```

- **302** con `location:` hacia `<team>.cloudflareaccess.com/cdn-cgi/access/login/...`
  → Access está delante. Correcto.
- **200** → Access no está aplicada (falta la aplicación, el path no coincide o la
  política es `Bypass`). **No despliegues** hasta corregirlo.
- **404/500** → primero corrige host o ruta del console; después valida Access.
- **Cualquier otro código** no confirma la protección: diagnostica la aplicación
  antes de desplegar.

`https://console.tucatalogo.live/health` y `/login` deben seguir respondiendo sin
Access (200): si también piden Access, el path de la aplicación está mal.

Tras el primer admin, `/init` responde 410 y el vector queda cerrado: la aplicación
de Access puede mantenerse (defensa en profundidad) o retirarse sin reabrir el alta.

## Orden de deploy

El API va primero: los frontends consumen su contrato.

0. **Cloudflare Access del alta** activa y verificada (302 en `/init`). Es
   requisito previo: el deploy no la configura y sin ella `/init` queda abierto.
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
| [`sync-secrets.yml`](../.github/workflows/sync-secrets.yml) | **solo `workflow_dispatch`** (`target: prod`, `confirm: sync`) | `prod` | No despliega: `wrangler secret put --env prod` de los 4 secretos del api |

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
  Excepciones puntuales viven en `pnpm-workspace.yaml` → `auditConfig.ignoreGhsas`
  (pnpm 10 lee `ignoreGhsas` para GHSA; `ignoreCves` espera CVE), siempre con el
  motivo escrito al lado y una fecha de caducidad implícita: se retiran cuando la
  dependencia recibe parche. Hoy hay una sola: `GHSA-fc5q-39xc-vjpf` (picomatch
  vía `better-auth > vitest`, dev-only y sin versión parcheada). El audit reporta
  los ignorados como `(1 ignored)`, no los oculta.
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
| prod | `https://<SMOKE_STORE_HOST>/health` | `https://tucatalogo.live/health` | `https://console.tucatalogo.live/health` |

- `env.dev` no tiene smoke automático: su workflow ya no existe.
- En prod el storefront no tiene host fijo (depende del slug), así que el
  workflow lee la variable `SMOKE_STORE_HOST` (p. ej. `demo.tucatalogo.live`, una
  tienda de bajo riesgo). Si la variable no existe, cae en `demo.tucatalogo.live`
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
curl -s https://tucatalogo.live/ | head
curl -sI "https://<tienda-de-prueba>.tucatalogo.live/"
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

**Ojo con el alta:** un rollback a una versión anterior de `console`/`api` que
todavía pide `INIT_TOKEN` exige **recrear** el secreto (`wrangler secret put
INIT_TOKEN --env prod` y el Environment secret en GitHub); si se borró, el rollback
de código no restaura ese flujo. Si el alta ya se consumió, el 410 aplica igual en
ambas versiones y el rollback es inocuo para `/init`.

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
3. `APP_DOMAIN` en los cuatro workers y `STORE_ORIGIN_TEMPLATE` con la nueva
   raíz de tiendas.
4. `STORE_ORIGIN_TEMPLATE`, `CONSOLE_ORIGIN` y `MEDIA_BASE_URL` en el API.
5. `PROD_HOSTS` y `PROD_REDIRECT_HOSTS` de `packages/shared/src/constants/hosts.ts`
   y la lista de slugs reservados (los hosts exactos nuevos entran como reservados).
6. Custom domain del bucket de R2 y Redirect Rule de `www`.
7. Resend (dominio de envío) y Turnstile (hostnames del widget).
8. Documentación y smoke de los hosts nuevos.

Las cookies son host-only y no llevan `Domain`: no hay migración de sesiones, solo
se vuelve a iniciar sesión en el host nuevo.

## Migración desde `luisrivas.site` (limpieza)

El proyecto vivió antes en `luisrivas.site`. Esa zona **no se borra ni se
reconfigura**: solo se eliminan los registros que eran nuestros, para no dejar
hosts colgando ni interceptables.

| Registro a eliminar (zona `luisrivas.site`, `a9c8ba1ce44e6421f623f73b69d3e256`) | Motivo |
| --- | --- |
| `tucatalogo.luisrivas.site` | Antiguo commercial |
| `*.tucatalogo.luisrivas.site` | Antiguo comodín de tiendas |
| `console-tucatalogo.luisrivas.site` | Antiguo console |
| `tucatalogo-bucket.luisrivas.site` | Antiguo custom domain de R2 |

No se toca nada más de esa zona (apex, `www`, ni registros de otros proyectos).

## Pendiente cloud

- **Hecho en Cloudflare:** zona `tucatalogo.live`, D1 `tucatalogo-prod`
  (`ed32bca0-2ed9-4a07-97e5-018e8a15049f`, ENAM), R2 `tucatalogo-media-prod`,
  worker `api` desplegado con sus secretos y worker `web` desplegado **sin ruta**.
- **Pendiente en Cloudflare:**
  - **Cloudflare Access del alta**: aplicación self-hosted `console.tucatalogo.live`
    con path `init` y política del owner (ver *Cloudflare Access del alta*). Debe
    existir **antes** del primer deploy del console sin token.
  - Añadir la zona **`tucatalogo.live`** al `CLOUDFLARE_API_TOKEN` con
    `Workers Routes → Edit` + `Zone → Read` (y mantener D1/Workers/R2): sin eso no
    se aplican las rutas de `web`, `commercial` ni `console`.
  - **DNS de `tucatalogo.live`**: `@`, `*`, `console`, `www` proxied, y el custom
    domain `bucket` de R2. Sin ellos todo resuelve NXDOMAIN.
  - Turnstile: actualizar los hostnames del widget a `tucatalogo.live`.
  - Resend: verificar el dominio de envío `tucatalogo.live` (SPF/DKIM).
  - Redirect Rule 301 de `www` → `tucatalogo.live` (el apex ya es el commercial).
  - **Gate F0 (wildcard vs bucket): abierto** — con todo en una zona,
    `*.tucatalogo.live` puede casar con `bucket.tucatalogo.live`. Revalidar con
    `curl`; si intercepta, ruta de negación sin script.
- **En GitHub:** Environment `prod` con los 4 Environment secrets
  (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`), las variables `TURNSTILE_SITE_KEY` y
  `SMOKE_STORE_HOST` (`demo.tucatalogo.live`) y los 2 Repository secrets
  de Cloudflare. El antiguo `INIT_TOKEN` se elimina del Environment y del worker
  (ADR 0002).
- **Secretos del worker api en prod:** ✅ aplicados con `sync-secrets`
  (`wrangler secret put --env prod`). En rotaciones se relanza el workflow.
- **`env.dev`:** sigue en placeholders (`REPLACE_ME_DEV_*`) y no se usa. Si alguna
  vez se despliega a mano, se aplican secretos con `--env dev` y valores distintos.
- **Primer deploy real de los frontends con `CLOUDFLARE_ENV`** (validar que rutas,
  bindings y vars del entorno llegan al build generado).
- **Smoke real del API por service binding:** requiere una ruta de smoke en un
  frontend (hoy no existe; el workflow comprueba deployment + D1).
- **Lighthouse/axe contra prod.**
