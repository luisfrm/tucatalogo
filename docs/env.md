# Variables y secretos por entorno

Fuente de los valores: `wrangler.jsonc` de cada app (top-level = local,
`env.dev`, `env.prod`) y los `.dev.vars.example` del repositorio. Este documento
no contiene secretos reales: donde aplica se usa `REPLACE_ME_*`.

## Cómo se carga la configuración

| Entorno | Variables no secretas | Secretos |
| --- | --- | --- |
| local | `vars` del `wrangler.jsonc` + `.dev.vars` (gitignored) | `apps/api/.dev.vars` |
| dev/prod | `vars` de `env.dev` / `env.prod` | `wrangler secret put <NAME> --env <dev\|prod>`; en prod lo ejecuta el workflow manual `sync-secrets` desde los **Environment secrets del GitHub Environment `prod`** |

- En local, `.dev.vars` **tiene prioridad** sobre `vars`. Por eso el
  `wrangler.jsonc` del API declara `EMAIL_DRIVER=console` y el `.dev.vars` de
  trabajo (y su ejemplo) usa `EMAIL_DRIVER=memory`.
- Los secretos viven **solo** en `apps/api`. Ni `web`, ni `commercial`, ni
  `console` reciben `BETTER_AUTH_SECRET_*`, `RESEND_API_KEY` ni
  `TURNSTILE_SECRET_KEY`. El alta del console (`/init`) **no usa secreto**: el
  formulario no envía ningún token y la página está detrás de **Cloudflare
  Access** (path `init` de `console.tucatalogo.live`), fuera de esta tabla porque
  no es una variable del worker.
- No hay fallbacks: una variable obligatoria ausente o un modo desconocido
  produce 500/503 + log. El `wrangler.jsonc` de cada app documenta su `env.dev` /
  `env.prod` con placeholders `REPLACE_ME_*` hasta que el owner cree los
  recursos.
- **Quién los define:** el owner del repo fija las variables de dev/prod en
  `wrangler.jsonc`; los 4 secretos de runtime de prod se guardan como
  **Environment secrets del GitHub Environment `prod`** y se aplican al worker con
  el workflow manual `sync-secrets.yml` (`wrangler secret put --env prod`). El
  Environment `prod` no tiene reglas de protección ni aprobaciones: agrupa
  secretos y variables por destino, no añade un paso humano. En dev, si se
  despliega a mano, se usan `wrangler secret put --env dev` con valores distintos.
  Cada dev define sus valores locales en su `.dev.vars` (nunca se versionan).

## Reglas

1. **Sin fallbacks silenciosos.** Falta de configuración → 503; corrupción al
   leer → 500. Nunca un host, tema o remitente inventado.
2. **`MEDIA_BASE_URL` es la única variable de media.** Un solo valor por
   entorno, sin barra final. Prod: `https://bucket.tucatalogo.live`;
   local: `http://127.0.0.1:9797/media`; dev: un único valor explícito por
   entorno (el host público del bucket de dev **o** la ruta `/media` del worker
   dev, nunca los dos).
3. **`EMAIL_DRIVER=memory` solo en local.** Fuera de `local` el API responde 503
   con log y no envía nada. `console` también es un driver de desarrollo: el
   código solo emite un `warn` si se usa fuera de local, pero no es un modo
   válido para dev/prod. En dev/prod el único driver admitido es `resend`.
4. **`TURNSTILE_MODE=test` o `disabled` solo en local.** `disabled` fuera de
   local es un fallo de configuración (503). `test` acepta cualquier token no
   vacío y no llama a la red; `enabled` exige `TURNSTILE_SECRET_KEY` y usa
   `siteverify`.
5. **El alta del console no usa secreto.** `/init` está detrás de **Cloudflare
   Access** (aplicación self-hosted sobre `console.tucatalogo.live` con path
   `init` y política del email del owner) y sigue siendo one-time (410 después del
   primer admin) con rate limit por IP y `audit_log` (`admin.init`). No hay
   `INIT_TOKEN` que generar, guardar ni rotar: no existe en `.dev.vars`, ni en el
   worker, ni en GitHub. Si alguien encuentra un `INIT_TOKEN` huérfano en el
   worker, ver *Limpiar `INIT_TOKEN` huérfano* más abajo.
6. **Dos secretos de Better Auth distintos** (`_STORE` y `_CONSOLE`), uno por
   reino. Rotarlos invalida las sesiones emitidas con el anterior.
7. **Cookies host-only.** No existe `domain=.tucatalogo.live` ni variable para
   configurarlo.

## Variables por app

Leyenda de tipo: **var** = configuración no secreta; **secreto** = Worker secret
(o `.dev.vars` en local); **binding** = recurso de Cloudflare.

### `apps/api`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | Habilita `/media/*` y `/dev/*` en local/development; decide `EMAIL_DRIVER=memory` y `TURNSTILE_MODE=disabled` |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `tucatalogo.live` | var | Raíz de la subzona de tiendas (`{slug}.` + este valor); la usa `STORE_ORIGIN_TEMPLATE` |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://bucket.tucatalogo.live` | var | Única fuente de URLs de media; sin barra final |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Declarada en `Env` y en el ejemplo; el worker `api` no la usa (es del adapter de los frontends) |
| `EMAIL_DRIVER` | `memory` (ejemplo) / `console` (`wrangler.jsonc`) | `resend` | `resend` | var | `memory` \| `console` \| `resend`; ausente o desconocida → 503 |
| `EMAIL_FROM` | `TuCatálogo <no-reply@localhost>` | `REPLACE_ME_DEV_EMAIL_FROM` | `TuCatálogo <no-reply@tucatalogo.live>` | var | Obligatorio con `resend` |
| `RESEND_FROM` | — (comentado) | — | — | var | Si existe, tiene prioridad sobre `EMAIL_FROM` |
| `RESEND_API_KEY` | — | secreto | secreto (Environment secret `prod` → `sync-secrets`) | secreto | Obligatorio con `EMAIL_DRIVER=resend`; sin él → 503 |
| `TURNSTILE_MODE` | `test` | `enabled` | `enabled` | var | `test` \| `enabled` \| `disabled` (solo local) |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` (clave oficial de prueba) | secreto | secreto (Environment secret `prod` → `sync-secrets`) | secreto | Obligatorio con `enabled` |
| `TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | — | — | var | Declarada en `Env`; el API no la lee (la usa commercial) |
| `STORE_ORIGIN_TEMPLATE` | `http://{slug}.localhost:5173` | `https://REPLACE_ME_DEV_WEB_ORIGIN` | `https://{slug}.tucatalogo.live` | var | Origen del enlace de reset de tienda |
| `CONSOLE_ORIGIN` | `http://localhost:5175` | `https://REPLACE_ME_DEV_CONSOLE_ORIGIN` | `https://console.tucatalogo.live` | var | Origen del enlace de reset del console |
| `BETTER_AUTH_SECRET_STORE` | `.dev.vars` (32+ bytes) | secreto | secreto (Environment secret `prod` → `sync-secrets`) | secreto | Reino tienda; distinto por entorno |
| `BETTER_AUTH_SECRET_CONSOLE` | `.dev.vars` (32+ bytes) | secreto | secreto (Environment secret `prod` → `sync-secrets`) | secreto | Reino console; distinto por entorno |
| `DB` | `tucatalogo-local` | `tucatalogo-dev` | `tucatalogo-prod` | binding | D1. El `database_id` real de prod es `ed32bca0-2ed9-4a07-97e5-018e8a15049f`; el de dev sigue como `REPLACE_ME_DEV_D1_DATABASE_ID` |
| `MEDIA_BUCKET` | `tucatalogo-local` | `tucatalogo-media-dev` | `tucatalogo-media-prod` | binding | R2 |

### `apps/web`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | `local`/`development` aceptan `?siteId`; `production` lo rechaza (400) y activa la base canónica y `noindex=false` |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `tucatalogo.live` | var | Base de la resolución de host: el slug se extrae de `{slug}.` + este valor |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local; dev/prod usan el binding `API` |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://bucket.tucatalogo.live` | var | Declarada en `wrangler.jsonc`; el código de `web` no la lee (las URLs llegan del API) |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

### `apps/commercial`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | — |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `tucatalogo.live` | var | Con el que se construyen los enlaces a la tienda: `{slug}.` + este valor (`slugDomain`) en `/registro`; **debe** ser la subzona |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://bucket.tucatalogo.live` | var | Declarada; el código de `commercial` no la lee |
| `TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | `REPLACE_ME_DEV_TURNSTILE_SITE_KEY` | `0x4AAAAAAGF7HGDrrRDDGsww` | var | **Obligatoria** en `/registro`: sin ella, 503. Pública: vive en `wrangler.jsonc`, no en GitHub |
| `TURNSTILE_MODE` | `test` | `enabled` | `enabled` | var | El código de `commercial` no la lee: el modo real lo aplica el API, donde `test` solo vale en local y dev/prod exigen `enabled` |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

> La site key de Turnstile es **pública** y se define como variable del worker
> `commercial` en `wrangler.jsonc`: `env.prod` ya lleva la clave real
> (`0x4AAAAAAGF7HGDrrRDDGsww`). No es un secreto, no va en GitHub y no se inyecta
> por `wrangler secret put`. El `TURNSTILE_SECRET_KEY` que la valida es un secreto
> del **api**. En `env.dev` la site key sigue como `REPLACE_ME_DEV_TURNSTILE_SITE_KEY`.

### `apps/console`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | — |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_CONSOLE_HOST` | `tucatalogo.live` | var | **No se usa para construir enlaces** con el slug de tienda: el console vive en `console.tucatalogo.live`, un host exacto. Solo valida que la variable exista en `/health`; no la uses para armar URLs de tienda (eso es `STORE_ORIGIN_TEMPLATE` en el api) |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://bucket.tucatalogo.live` | var | Declarada; el código de `console` no la lee |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

Sin secretos: el formulario `/init` no envía ningún token; la protección es la aplicación de Cloudflare Access sobre `console.tucatalogo.live/init`.

> Los `.dev.vars.example` de `web`, `commercial` y `console` incluyen
> `TURNSTILE_MODE` y `TURNSTILE_SITE_KEY` por simetría. Solo `commercial` lee
> `TURNSTILE_SITE_KEY`; el resto son inocuas pero no forman parte del contrato de
> esas apps.

## Variables solo de CI (GitHub)

**Deploy prod-only:** `deploy-prod.yml` corre automáticamente en cada push a
`master`/`main` (y por `workflow_dispatch`). Usa el **GitHub Environment `prod`**,
que **no tiene reglas de protección ni aprobaciones**: el deploy no espera a nadie.
Ojo con la homonimia: el `--env prod` de los comandos es el entorno de **Wrangler**
(`env.prod` del `wrangler.jsonc`); el `environment: prod` de los workflows es el
Environment de **GitHub** del que se leen secretos y variables.

**`wrangler deploy` no aplica secretos.** Los secretos del worker se cargan una
vez, sobreviven a los deploys y se cambian solo con `wrangler secret put`. Por eso
los 4 runtime secrets del api viven también como **Environment secrets de `prod`** y
se aplican con el workflow **manual**
[`sync-secrets.yml`](../.github/workflows/sync-secrets.yml) (`target: prod`,
`confirm: sync`).

Hay dos niveles de credenciales a propósito:

- **2 Repository secrets** de Cloudflare, compartidos por cualquier job y no
  atados a un entorno concreto.
- **4 Environment secrets** de runtime en `prod`, que solo existen como worker
  secrets del api y se copian con `sync-secrets`.

| Nombre | Tipo | Dónde | Uso |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | *Settings → Secrets and variables → Actions → Secrets* | wrangler: migraciones, deploy, status y D1 remoto |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | idem | idem |
| `BETTER_AUTH_SECRET_STORE` | Environment secret (`prod`) | *Settings → Environments → prod → Environment secrets* | Se copia al worker api con `sync-secrets` (`wrangler secret put --env prod`) |
| `BETTER_AUTH_SECRET_CONSOLE` | Environment secret (`prod`) | idem | idem; valor **distinto** de `_STORE` |
| `RESEND_API_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SECRET_KEY` | Environment secret (`prod`) | idem | idem |
| `TURNSTILE_SITE_KEY` | Environment variable (`prod`) | *Settings → Environments → prod → Environment variables* | `0x4AAAAAAGF7HGDrrRDDGsww`. Copia informativa: el valor que usa el widget es el de `env.prod` de `apps/commercial/wrangler.jsonc` |
| `SMOKE_STORE_HOST` | Environment variable (`prod`) o Repository variable | *Variables* | Host de la tienda de bajo riesgo para el smoke del storefront, sin esquema ni ruta. Si no existe, el workflow cae en `demo.tucatalogo.live` |

`TURNSTILE_SITE_KEY` es pública: el valor canónico vive en
`apps/commercial/wrangler.jsonc` (`env.prod`) y la variable de GitHub `prod` es una
copia para tener el destino prod completo en un solo sitio. No se inyecta en el
build ni sustituye al `wrangler.jsonc`.

`SMOKE_STORE_HOST` tiene un **fallback de CI**, no de runtime: mientras el owner no
cree la variable (en el Environment `prod` o a nivel de repo), el smoke apunta a
`demo.tucatalogo.live`. En cuanto exista una tienda real de bajo riesgo, el owner
debe crear la variable: un host que no existe hace fallar el smoke y con él el
deploy.

### Limpiar `INIT_TOKEN` huérfano

El alta del console ya no usa token (ADR 0002). Si el worker conserva el secreto de
la versión anterior, bórralo una vez:

```bash
cd apps/api
pnpm exec wrangler secret delete INIT_TOKEN --env prod
pnpm exec wrangler secret delete INIT_TOKEN --env dev   # solo si dev llegó a tenerlo
```

En GitHub, elimina el *Environment secret* homónimo en *Settings → Environments →
prod → Environment secrets*. Es limpieza, no un paso de deploy: ningún código lo
lee. `sync-secrets.yml` ya no lo enumera (sincroniza 4 secretos).

Ninguno de los secretos ni variables de GitHub de esta sección se guarda en el
repositorio ni en `.dev.vars`. Hay tres workflows en
`.github/workflows/` (`ci.yml`, `deploy-prod.yml` y `sync-secrets.yml`); no existe
`deploy-dev.yml`. `ci.yml` no usa Environment; `deploy-prod.yml` y `sync-secrets.yml`
sí (`prod`). El Environment `dev` existe en GitHub y **no se usa**: ningún workflow
despliega `env.dev`.

## Variables de test

`apps/api/vitest.config.ts` inyecta sus propios bindings en Miniflare
(`TEST_MIGRATIONS`, `ENVIRONMENT=local`, `EMAIL_DRIVER=memory`,
`TURNSTILE_MODE=test`, secretos de prueba). Los tests no leen `.dev.vars` ni
dependen de la red.

## Placeholders pendientes de sustituir

En `wrangler.jsonc` de `apps/api`:

- `REPLACE_ME_DEV_D1_DATABASE_ID`. El de prod ya está fijado:
  `tucatalogo-prod` = `ed32bca0-2ed9-4a07-97e5-018e8a15049f` (región ENAM).
- `REPLACE_ME_DEV_STOREFRONT_HOST`, `REPLACE_ME_DEV_MEDIA_BASE_URL`,
  `REPLACE_ME_DEV_EMAIL_FROM`, `REPLACE_ME_DEV_WEB_ORIGIN`,
  `REPLACE_ME_DEV_CONSOLE_ORIGIN`.

En `apps/web` y `apps/commercial`: `REPLACE_ME_DEV_STOREFRONT_HOST` (`APP_DOMAIN`)
y `REPLACE_ME_DEV_MEDIA_BASE_URL`. En `apps/console`:
`REPLACE_ME_DEV_CONSOLE_HOST` (`APP_DOMAIN`) y `REPLACE_ME_DEV_MEDIA_BASE_URL`.

`env.prod` ya no tiene placeholders: D1 (`tucatalogo-prod`), R2
(`tucatalogo-media-prod`), `APP_DOMAIN`, `MEDIA_BASE_URL`, `EMAIL_*`,
`TURNSTILE_MODE`, `TURNSTILE_SITE_KEY`, `STORE_ORIGIN_TEMPLATE` y `CONSOLE_ORIGIN`
tienen valor real. Ningún ID, dominio de dev ni clave real de dev se versiona. Ver
[`deploy.md`](./deploy.md) para el orden de sustitución y de deploy.
