# Variables y secretos por entorno

Fuente de los valores: `wrangler.jsonc` de cada app (top-level = local,
`env.dev`, `env.prod`) y los `.dev.vars.example` del repositorio. Este documento
no contiene secretos reales: donde aplica se usa `REPLACE_ME_*`.

## Cómo se carga la configuración

| Entorno | Variables no secretas | Secretos |
| --- | --- | --- |
| local | `vars` del `wrangler.jsonc` + `.dev.vars` (gitignored) | `apps/api/.dev.vars` |
| dev/prod | `vars` de `env.dev` / `env.prod` | `wrangler secret put <NAME> --env <dev\|prod>` |

- En local, `.dev.vars` **tiene prioridad** sobre `vars`. Por eso el
  `wrangler.jsonc` del API declara `EMAIL_DRIVER=console` y el `.dev.vars` de
  trabajo (y su ejemplo) usa `EMAIL_DRIVER=memory`.
- Los secretos viven **solo** en `apps/api`. Ni `web`, ni `commercial`, ni
  `console` reciben `BETTER_AUTH_SECRET_*`, `INIT_TOKEN`, `RESEND_API_KEY` ni
  `TURNSTILE_SECRET_KEY`. El console obtiene el `INIT_TOKEN` del formulario
  `/init` y lo reenvía por service binding.
- No hay fallbacks: una variable obligatoria ausente o un modo desconocido
  produce 500/503 + log. El `wrangler.jsonc` de cada app documenta su `env.dev` /
  `env.prod` con placeholders `REPLACE_ME_*` hasta que el owner cree los
  recursos.
- **Quién los define:** el owner del repo fija las variables de dev/prod en
  `wrangler.jsonc` y los secretos con `wrangler secret put`; cada dev define sus
  valores locales en su `.dev.vars` (nunca se versionan).

## Reglas

1. **Sin fallbacks silenciosos.** Falta de configuración → 503; corrupción al
   leer → 500. Nunca un host, tema o remitente inventado.
2. **`MEDIA_BASE_URL` es la única variable de media.** Un solo valor por
   entorno, sin barra final. Prod: `https://tucatalogo-bucket.luisrivas.site`;
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
5. **`INIT_TOKEN` solo en `api`.** 32 bytes = 64 hex, con valores distintos por
   entorno. Comparación en tiempo constante, `/init` one-time (después 410) y
   rate limit por IP. En local el valor de trabajo es
   `22f305ec398dd3b1f6e629a4724e59276ee8c5fdf7aec58a6b28c18307d4e4a8` (solo
   local; nunca se usa como secreto de prod).
6. **Dos secretos de Better Auth distintos** (`_STORE` y `_CONSOLE`), uno por
   reino. Rotarlos invalida las sesiones emitidas con el anterior.
7. **Cookies host-only.** No existe `domain=.luisrivas.site` ni variable para
   configurarlo.

## Variables por app

Leyenda de tipo: **var** = configuración no secreta; **secreto** = Worker secret
(o `.dev.vars` en local); **binding** = recurso de Cloudflare.

### `apps/api`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | Habilita `/media/*` y `/dev/*` en local/development; decide `EMAIL_DRIVER=memory` y `TURNSTILE_MODE=disabled` |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `luisrivas.site` | var | Dominio del storefront |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://tucatalogo-bucket.luisrivas.site` | var | Única fuente de URLs de media; sin barra final |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Declarada en `Env` y en el ejemplo; el worker `api` no la usa (es del adapter de los frontends) |
| `EMAIL_DRIVER` | `memory` (ejemplo) / `console` (`wrangler.jsonc`) | `resend` | `resend` | var | `memory` \| `console` \| `resend`; ausente o desconocida → 503 |
| `EMAIL_FROM` | `TuCatálogo <no-reply@localhost>` | `REPLACE_ME_DEV_EMAIL_FROM` | `TuCatálogo <no-reply@luisrivas.site>` | var | Obligatorio con `resend` |
| `RESEND_FROM` | — (comentado) | — | — | var | Si existe, tiene prioridad sobre `EMAIL_FROM` |
| `RESEND_API_KEY` | — | secreto | secreto | secreto | Obligatorio con `EMAIL_DRIVER=resend`; sin él → 503 |
| `TURNSTILE_MODE` | `test` | `enabled` | `enabled` | var | `test` \| `enabled` \| `disabled` (solo local) |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` (clave oficial de prueba) | secreto | secreto | secreto | Obligatorio con `enabled` |
| `TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | — | — | var | Declarada en `Env`; el API no la lee (la usa commercial) |
| `STORE_ORIGIN_TEMPLATE` | `http://{slug}.localhost:5173` | `https://REPLACE_ME_DEV_WEB_ORIGIN` | `https://{slug}.luisrivas.site` | var | Origen del enlace de reset de tienda |
| `CONSOLE_ORIGIN` | `http://localhost:5175` | `https://REPLACE_ME_DEV_CONSOLE_ORIGIN` | `https://console-tucatalogo.luisrivas.site` | var | Origen del enlace de reset del console |
| `BETTER_AUTH_SECRET_STORE` | `.dev.vars` (32+ bytes) | secreto | secreto | secreto | Reino tienda; distinto por entorno |
| `BETTER_AUTH_SECRET_CONSOLE` | `.dev.vars` (32+ bytes) | secreto | secreto | secreto | Reino console; distinto por entorno |
| `INIT_TOKEN` | `.dev.vars` (32 bytes / 64 hex; valor local en la regla 5) | secreto (32 bytes / 64 hex) | secreto (32 bytes / 64 hex) | secreto | Solo esta app; rotación en el runbook |
| `DB` | `tucatalogo-local` | `tucatalogo-dev` | `tucatalogo-prod` | binding | D1 (`database_id` de dev/prod es `REPLACE_ME_*`) |
| `MEDIA_BUCKET` | `tucatalogo-local` | `tucatalogo-media-dev` | `tucatalogo-media-prod` | binding | R2 |

### `apps/web`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | `local`/`development` aceptan `?siteId`; `production` lo rechaza (400) y activa la base canónica y `noindex=false` |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `luisrivas.site` | var | Base de la resolución de host |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local; dev/prod usan el binding `API` |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://tucatalogo-bucket.luisrivas.site` | var | Declarada en `wrangler.jsonc`; el código de `web` no la lee (las URLs llegan del API) |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

### `apps/commercial`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | — |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_STOREFRONT_HOST` | `luisrivas.site` | var | Dominio con el que se construyen los enlaces a la tienda |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://tucatalogo-bucket.luisrivas.site` | var | Declarada; el código de `commercial` no la lee |
| `TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | **falta** en `wrangler.jsonc` | — | var | **Obligatoria** en `/registro`: sin ella, 503 |
| `TURNSTILE_MODE` | `test` | `test` (inerte) | — | var | El código de `commercial` no la lee: el modo real lo aplica el API, donde `test` solo vale en local y dev/prod exigen `enabled` |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

> La clave de sitio de Turnstile de dev/prod se define como variable del worker
> `commercial` (no es secreta). El `env.prod` no la declara todavía: se añade al
> crear el widget real (pendiente cloud).

### `apps/console`

| Variable | local | dev | prod | Tipo | Notas |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `local` | `development` | `production` | var | — |
| `APP_DOMAIN` | `localhost` | `REPLACE_ME_DEV_CONSOLE_HOST` | `luisrivas.site` | var | Host del console |
| `API_INTERNAL_URL` | `http://127.0.0.1:9797` | — | — | var | Solo local |
| `MEDIA_BASE_URL` | `http://127.0.0.1:9797/media` | `REPLACE_ME_DEV_MEDIA_BASE_URL` | `https://tucatalogo-bucket.luisrivas.site` | var | Declarada; el código de `console` no la lee |
| `API` | — (sin binding) | `tucatalogo-api-dev` | `tucatalogo-api-prod` | binding | Service binding |

Sin secretos: el `INIT_TOKEN` llega del formulario `/init`.

> Los `.dev.vars.example` de `web`, `commercial` y `console` incluyen
> `TURNSTILE_MODE` y `TURNSTILE_SITE_KEY` por simetría. Solo `commercial` lee
> `TURNSTILE_SITE_KEY`; el resto son inocuas pero no forman parte del contrato de
> esas apps.

## Variables solo de CI (GitHub)

| Nombre | Dónde | Quién lo define |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | GitHub Environment `dev` / `prod` | Owner del repo |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Environment `dev` / `prod` | Owner del repo |
| `SMOKE_STORE_HOST` | Environment `prod` (o repositorio) | Owner: host de la tienda de bajo riesgo para el smoke del storefront (`demo.luisrivas.site`). Sin esquema ni ruta |

No se guardan en el repositorio ni en `.dev.vars`. Los tres workflows existen en
`.github/workflows/` (`ci.yml`, `deploy-dev.yml`, `deploy-prod.yml`); los dos de
deploy todavía no se han ejecutado (sin credenciales ni recursos Cloudflare).

## Variables de test

`apps/api/vitest.config.ts` inyecta sus propios bindings en Miniflare
(`TEST_MIGRATIONS`, `ENVIRONMENT=local`, `EMAIL_DRIVER=memory`,
`TURNSTILE_MODE=test`, secretos de prueba). Los tests no leen `.dev.vars` ni
dependen de la red.

## Placeholders pendientes de sustituir

En `wrangler.jsonc` de `apps/api`:

- `REPLACE_ME_DEV_D1_DATABASE_ID` y `REPLACE_ME_PROD_D1_DATABASE_ID`.
- `REPLACE_ME_DEV_STOREFRONT_HOST`, `REPLACE_ME_DEV_MEDIA_BASE_URL`,
  `REPLACE_ME_DEV_EMAIL_FROM`, `REPLACE_ME_DEV_WEB_ORIGIN`,
  `REPLACE_ME_DEV_CONSOLE_ORIGIN`.

En `apps/web` y `apps/commercial`: `REPLACE_ME_DEV_STOREFRONT_HOST` (`APP_DOMAIN`)
y `REPLACE_ME_DEV_MEDIA_BASE_URL`. En `apps/console`:
`REPLACE_ME_DEV_CONSOLE_HOST` (`APP_DOMAIN`) y `REPLACE_ME_DEV_MEDIA_BASE_URL`.

Ningún ID, dominio de dev ni clave real se versiona. Ver
[`deploy.md`](./deploy.md) para el orden de sustitución y de deploy.
