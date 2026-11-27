# Plan de implementación – MVP v1.1

**Proyecto:** TuCatálogo – SaaS multitienda de catálogos
**Versión del plan:** 1.1 · **Fecha:** 2026-11-17 · **Estado:** vigente
**Alcance:** Fase 1 (MVP). Todo lo demás va al backlog de Fase 2 (§19).

> Este documento reemplaza las decisiones de la v1.0 donde haya conflicto. Los requerimientos se conservan como baseline en `Requerimientos MVP – Plataforma de Catálogos.md`.

---

## 1. Metadatos y fuentes

### 1.1 Fuentes usadas

| Fuente | Uso |
| --- | --- |
| `Requerimientos MVP – Plataforma de Catálogos.md` (v1.0) | Baseline funcional, criterios de aceptación y supuestos |
| `AGENTS.md` | Contexto operativo de los agentes y reglas no negociables |
| `prompt.txt` | Intención original del producto (stack, apps, temas, fases) |
| Decisiones cerradas v1.1 (2026-11-17) | Correcciones de arquitectura, auth, registro, media, hosts y alcance |
| Decisión del owner (2026-11-18) | Alta del console sin `INIT_TOKEN`, protegida por Cloudflare Access → `docs/adr/0002-init-without-token.md` |
| `skills-lock.json` | Confirma `ui-ux-pro-max` instalada (commit `e59ff37`, source `nextlevelbuilder/ui-ux-pro-max-skill`) |
| `.opencode/agents/*.md` | Subagentes disponibles para delegación |

### 1.2 Estado real del repositorio

Verificado en disco:

- Monorepo pnpm con `apps/api`, `apps/web`, `apps/commercial`, `apps/console` y los siete paquetes.
- F1 (monorepo), F2 (API y auth), F3 (commercial), F4 (storefront y temas), F5 (`/panel-admin`) y F6 (console) implementados. `docs/` y los tres workflows (`ci.yml`, `deploy-prod.yml`, `sync-secrets.yml`) existen.
- **Pendiente cloud:** hosts de `env.dev`, `TURNSTILE_SITE_KEY` de dev (la de prod ya está en `apps/commercial/wrangler.jsonc`), DNS de la subzona `tucatalogo.live`, permiso de rutas del token y el deploy completo de los frontends. D1/R2 de prod y los secretos del worker api ya están hechos.
- Scripts reales en `package.json`: `pnpm dev` (`:api`, `:web`, `:commercial`, `:console`), `build`, `lint`, `typecheck`, `test`, `db:migrate:local`, `db:seed:local`. No existe `db:migrate:<env>`.

Los comandos de este plan son los que existen hoy en `package.json` o los que ejecutan los workflows; el detalle operativo está en `README.md` y `docs/*`.

### 1.3 Convenciones del documento

- **Decisión cerrada**: no se discute; si un entregable la contradice, se rechaza.
- **Derivado**: detalle de implementación necesario para cumplir una decisión, listado en §20 para confirmación. No añade producto.
- **Propuesta**: nombre de ruta, script o recurso aún no fijado.
- Días = días-dev de una persona a tiempo completo.

---

## 2. Decisiones cerradas

### 2.1 Decisiones estructurales (D1–D6)

| ID | Decisión | Consecuencia principal |
| --- | --- | --- |
| **D1** | Cuatro workers y cuatro superficies. `apps/api` (Hono, sin ruta pública), `apps/commercial` (landing + registro), `apps/web` (storefront `slug.*` **y** `/panel-admin`), `apps/console` (backoffice SaaS de tenants). **No existe `apps/panel`.** | El panel del dueño es un conjunto de rutas de `apps/web`; el console es otro worker y otro reino de auth |
| **D2** | Auth con **dos reinos separados**: `store_users` (dueños) y `admin_users` (console). Dos instancias Better Auth, secretos distintos, cookies host-only con prefijo `store` / `console`. Mismo email permitido en ambos reinos. Una cuenta = una tienda (`store.owner_id` único). | Sin tabla `user` compartida; sin `packages/auth`; sin sesión cruzada entre tienda y console |
| **D3** | Ciclo de vida de tienda con `status` (`pending` \| `active` \| `suspended`), `suspendedBy` (`owner` \| `admin`) y `suspendedReason`. **Sin `isActive` en `store`.** Owner solo reactiva si `suspendedBy = owner`; console reactiva siempre. Eliminar = hard delete (D1 + R2 + `store_users`) + cuarentena de slug 90 días. | Suspensión y borrado son operaciones distintas, auditables y con permisos distintos |
| **D4** | Registro **sin persistir nada** hasta verificar el OTP. `signup_intent` guarda email, hash del OTP, intentos y expiración; **nunca la contraseña**. El paso 1 pide nombre, email, contraseña, nombre de tienda, slug y moneda; el slug se valida en vivo y se revalida al crear. Sin tienda `pending` ni purga a 24 h. | La creación es un único acto atómico post-OTP; no hay basura que limpiar |
| **D5** | Imágenes: entrada máxima 2 MB; normalización **en el navegador** a WebP full 1600 px + thumb 600 px; EXIF eliminado. Hero con par desktop/mobile. Topes: 8 imágenes por producto, 10 slides de hero. | El servidor no procesa imágenes: valida y almacena. Coste de CPU y de R2 acotado |
| **D6** | Hosts: un solo dominio `tucatalogo.live`; commercial en el apex; console en `console.tucatalogo.live`; web en `*.tucatalogo.live` (storefront + `/panel-admin`); API solo por service binding; R2 en `bucket.tucatalogo.live`. `www` → 301 al apex con Redirect Rules. Dev: `*-dev.workers.dev` + `?siteId`, sin wildcard. | El wildcard cubre solo tiendas: apex, `console` y `bucket` son hosts exactos que ganan por precedencia, y `web` rechaza esos labels como reservados |

### 2.2 Políticas no negociables (P1–P7)

| ID | Política |
| --- | --- |
| **P1** | **Sin fallbacks silenciosos.** Env/config se valida al arrancar y en health: si falta, 500/503 + log. R2 con un solo host, sin alternativa `cdn.`. Tema o moneda inválidos: 400 al escribir, 500 + log si hay corrupción al leer. Sin placeholders ni defaults que oculten fallos. |
| **P2** | **Server-first.** React Router v8 framework mode con loaders/actions. `packages/api-client` (Hono RPC + adapter service binding/localhost + funciones de dominio en TS puro). El navegador **nunca** llama al API; mutaciones por actions o resource routes same-origin. Sin TanStack Query. |
| **P3** | **Capas en el API:** Route > Service > Repository. D1/Drizzle solo en repositories; los services no importan Drizzle. Código compartido: si se usa 2+ veces en una app → `apps/<app>/src`; si se usa en 2+ apps → `packages/shared`. |
| **P4** | **Aislamiento por tienda.** El `storeId` sale siempre de la sesión o del slug resuelto en servidor, nunca de un parámetro del cliente. Toda query filtra por `store_id`. |
| **P5** | **Contratos.** Zod en entrada y salida; envelope de error consistente; entrada inválida = 4xx, fallo grave = 5xx. |
| **P6** | **UI.** Radix + CVA + Tailwind v4; variantes con tokens semánticos; contraste WCAG AA; mobile-first; estados de carga, vacío y error en toda pantalla. |
| **P7** | **Temas.** 5 temas nombrados con claro y oscuro; mismo layout y grilla; cambia el sistema de diseño. Injector SSR con CSS vars en `<head>` sin FOUC; claro por defecto, oscuro por cookie. Motor OKLCH que ajusta el color principal para AA, sin fallback a un tema por defecto. |

---

## 3. Enmiendas a v1.0

Cada fila sustituye el texto de la v1.0. No se reescribe el documento original (solo lleva una nota al inicio).

| # | v1.0 decía | v1.1 establece |
| --- | --- | --- |
| 1 | `apps/panel` con ruta `*.tucatalogo.live/panel-admin/*` | `apps/panel` **no existe**. `/panel-admin` son rutas de `apps/web`. Se añade `apps/console` como backoffice SaaS |
| 2 | Una tabla `user` / `session` / `account` / `verification` | Dos reinos y dos juegos de tablas: `store_*` y `admin_*` (+ `admin_two_factor`). Sin tabla compartida |
| 3 | `store.status` + `store.isActive` | `status` (`pending`\|`active`\|`suspended`) + `suspendedBy` + `suspendedReason`. **Se elimina `isActive`** |
| 4 | Tienda nace `pending`, pasa a `active` al verificar OTP; purga a 24 h | Se crea **después** del OTP y nace `active`. No hay tiendas pendientes ni purga. `signup_intent` es el único registro temporal. Slug en el paso 1 |
| 5 | Imágenes hasta 5 MB subidas tal cual | Entrada máxima 2 MB, normalización en navegador a WebP 1600/600, EXIF eliminado, topes 8 y 10 |
| 6 | Sin super-admin en el MVP | Console con `/init`, 2FA TOTP obligatorio, suspender/reactivar/eliminar y audit log |
| 7 | Commercial en un host del dominio raíz; panel como worker aparte | Commercial en el apex `tucatalogo.live`; console en `console.tucatalogo.live`; `www` → 301; R2 con custom domain |
| 8 | Imágenes servidas "desde R2" sin más | Una sola variable de media (`MEDIA_BASE_URL`) y un único host por entorno (`bucket.tucatalogo.live` en prod), **sin fallback** a `cdn.`; si falla, 500/502 + alerta |
| 9 | Skill `ui-ux-pro-max` no disponible | Skill **sí disponible** (verificada en `skills-lock.json`) y se usa para afinar los 5 temas. `packages/themes` compartido por web y commercial |
| 10 | — | Sin TanStack Query: loaders/actions + `packages/api-client`. Sin `packages/auth` ni `packages/data` |
| 11 | Errores "consistentes" | Regla explícita de **no fallbacks silenciosos** (§12) |
| 12 | Reservados: `www, api, panel, admin, app, mail, static, media, assets, cdn, commercial` | Se añaden `tucatalogo`, `console-tucatalogo`, `tucatalogo-bucket` y se mantiene `www` |
| 13 | Registro sin Turnstile ni páginas legales | Turnstile en registro/OTP y páginas de términos y privacidad |
| 14 | Supuesto "un único D1 es suficiente" sin plan de coste | Workers **Paid** asumido como prerrequisito (§18) |

---

## 4. Arquitectura

### 4.1 Apps y paquetes

| Unidad | Rol | Acceso a datos |
| --- | --- | --- |
| `apps/api` | Hono. Toda la lógica de negocio, auth y media | **Único** con bindings D1 y R2 |
| `apps/commercial` | Landing pública y registro multipaso (4 pasos) | Solo service binding → api |
| `apps/web` | Storefront por subdominio + `/panel-admin` (panel del dueño) | Solo service binding → api |
| `apps/console` | Backoffice SaaS: tenants, suspensión, borrado, audit | Solo service binding → api |
| `packages/db` | Esquema Drizzle, migraciones versionadas, seeds SQL | Importado **solo** por repositories de `apps/api` |
| `packages/types` | Schemas Zod y tipos derivados | Sin runtime propio |
| `packages/shared` | Código usado por 2+ apps (constantes, libs, utilidades puras) | Sin acceso a datos |
| `packages/api-client` | Cliente Hono RPC tipado + adapter (service binding / localhost) + funciones de dominio | Solo servidor (loaders/actions) |
| `packages/themes` | Tokens de los 5 temas (claro/oscuro), fuentes self-hosted, metadata del picker, motor OKLCH | Compartido por `web` (injector) y `commercial` (preview) |
| `packages/ui` | Componentes globales Radix + CVA | Sin lógica de dominio |
| `packages/config` | tsconfig, eslint, tailwind preset | — |

Regla de ubicación (P3): `constants/*.ts` y `libs/*.ts` que se usan 2+ veces **en una app** viven en `apps/<app>/src`; si se usan en **2+ apps**, en `packages/shared`. Componentes específicos en `apps/<app>/app/components` y `apps/<app>/app/features`.

### 4.2 Hosts y rutas (prod)

| Host / ruta | Destino | Notas |
| --- | --- | --- |
| `tucatalogo.live/*` | Worker `commercial` | Apex del dominio propio |
| `console.tucatalogo.live/*` | Worker `console` | Host exacto; reino `admin` |
| `*.tucatalogo.live/*` | Worker `web` | Storefront y `/panel-admin` de cada tienda |
| — | Worker `api` | **Sin ruta pública**; solo service binding |
| `bucket.tucatalogo.live/*` | R2 custom domain | Host único de imágenes; es el valor prod de `MEDIA_BASE_URL` |
| `www.tucatalogo.live/*` | Redirect Rule 301 → `tucatalogo.live` | Fuera de Workers |

Reglas de convivencia:

1. **Un solo dominio (`tucatalogo.live`).** El apex es el commercial; `console` y `bucket` (R2) son hosts exactos de la misma zona; `*.tucatalogo.live` cubre solo las tiendas y `www` redirige al apex. `tucatalogo.live` queda fuera del proyecto.
2. Cloudflare prioriza la ruta más específica: `console.tucatalogo.live/*` y `tucatalogo.live/*` ganan a `*.tucatalogo.live/*`.
3. Defensa en profundidad: `web` valida el slug contra la lista de reservados (`console`, `bucket`, `www`, `admin`, `panel`, …) y responde 404 con log si recibe un host que no le corresponde.
4. **Gate F0: reabierto con la zona única.** `*.tucatalogo.live/*` **sí puede** casar con `bucket.tucatalogo.live` (es un solo label bajo el apex), así que la precedencia frente al custom domain de R2 debe verificarse empíricamente. Si el wildcard intercepta, la salida es una **ruta de negación** (`bucket.tucatalogo.live/*` sin script, vía API/dashboard) — nunca un host alternativo ni `cdn.`.

### 4.3 Rutas internas (estado real)

Las rutas de commercial (F3), storefront (F4) y console (F6) están implementadas y se listan en `README.md`. `/panel-admin` (F5) **ya está implementado**: son rutas de `apps/web` con login, recuperación, productos, categorías, hero, settings y la página de tienda eliminada.

| Superficie | Rutas | Estado |
| --- | --- | --- |
| Commercial | `/`, `/registro`, `/registro/slug-check`, `/terminos`, `/privacidad`, `/health` | Implementado (F3) |
| Web – storefront | `/`, `/producto/:slug`, `/color-mode` (POST), `/sitemap.xml`, `/robots.txt`, `/health` | Implementado (F4) |
| Web – panel | `/panel-admin` (dashboard), `/panel-admin/login`, `/panel-admin/recuperar`, `/panel-admin/reset-password` (ruta que enlaza el correo del API) + alias `/panel-admin/restablecer`, `/panel-admin/logout`, `/panel-admin/mode`, `/panel-admin/productos`, `/panel-admin/productos/nuevo`, `/panel-admin/productos/:id`, `/panel-admin/categorias`, `/panel-admin/hero`, `/panel-admin/settings`, `/panel-admin/eliminada` | Implementado (F5) |
| Console | `/init`, `/login`, `/2fa`, `/recuperar`, `/restablecer`, alias `/reset-password`, `/logout`, `/`, `/tiendas/:id`, `/auditoria`, `/health` | Implementado (F6) |
| API | `/health` (interno), `/media/*` (local/development), `/dev/outbox*` (solo local), `/auth/store/*`, `/auth/console/*`, `/panel/*`, `/public/:slug/*`, `/console/*` | §8 |

### 4.4 Service bindings

```
commercial ─┐
web ────────┼─ service binding ─▶ api ─┬─ D1 (por entorno)
console ────┘                          └─ R2 (por entorno)
```

- Un binding por entorno en cada `wrangler.jsonc` (`env.dev`, `env.prod`). En local el adapter de `packages/api-client` usa `API_INTERNAL_URL=http://127.0.0.1:9797` (puerto del worker `api` en `wrangler dev`).
- El API no se consume por URL pública entre workers: no hay CORS, no hay tokens de servicio, no hay endpoints "para el navegador".
- Cada app tiene además su propio `env` con las variables que necesita; el detalle por app y entorno está en `docs/env.md` (F7) y el listado de secretos en §13.5.

### 4.5 Flujos

**A. Registro (commercial)**

1. Paso 1: nombre, email, contraseña, nombre de tienda, slug, moneda. Validación Zod en cliente; el slug se comprueba en vivo contra `GET /auth/store/slug-check` (formato, reservados, ocupado, cuarentena).
2. Paso 2: tema con preview real (`packages/themes`, mismo render que el storefront).
3. Paso 3: `POST /auth/store/signup/otp` {email, slug, turnstileToken}. El API valida Turnstile, formato y disponibilidad, crea `signup_intent` (email, hash del OTP, `attempts = 0`, `expires_at = now + 10 min`) y envía el código de 6 caracteres por Resend. Reenvío con espera de 60 s y límite por hora.
4. Paso 4: `POST /auth/store/signup` con **el payload completo otra vez** + código. El API verifica el intent (expiración, intentos, hash), lo consume en una transacción, **revalida email y slug** (las constraints únicas son la última palabra), crea `store_users` + `store` con `status = active` y devuelve la confirmación con enlaces a la tienda y a `/panel-admin`.
5. La contraseña **no se persiste nunca** antes de este último paso: viaja solo en el formulario y en ese POST. El OTP no crea sesión: la cookie de tienda solo puede fijarse en el host de la tienda, así que el dueño inicia sesión en `slug.tucatalogo.live/panel-admin/login`.

**B. Login de tienda**

1. `slug.tucatalogo.live/panel-admin/login` → action same-origin → `POST /auth/store/login`.
2. El API resuelve la tienda desde `x-store-slug` (cabecera que fija el worker que atiende el host; para resolver la tienda no usa el body ni `?siteId`), autentica contra Better Auth `store` y exige `store.owner_id === user.id`. Si el usuario no es dueño de esa tienda → 403 (no se filtra si el email existe). En dev/local el worker frontal resuelve antes el `?siteId`, pero la comprobación de propiedad no cambia.
3. Cookie host-only con prefijo `store` en `slug.tucatalogo.live`. Sin `domain=.tucatalogo.live`.
4. Logout borra la sesión en D1 y la cookie. Sesión inválida/expirada → redirect a login desde el loader.

**C. Login de console**

1. `console.tucatalogo.live/login` → action → `POST /auth/console/login`.
2. Contraseña correcta + 2FA activo → challenge de corta vida; el usuario introduce TOTP o backup code en `/2fa`. Sin 2FA activo, el acceso queda bloqueado hasta completar el enrolamiento (obligatorio).
3. Cookie host-only prefijo `console` en el host del console.
4. `/init` (§4.5 F) crea al primer admin y exige enrolar TOTP en el mismo flujo.

**D. Storefront**

1. Request a `slug.tucatalogo.live/*` → worker `web`.
2. El loader extrae el slug del `Host` (o `?siteId` en dev, §20), lo normaliza y lo valida contra formato y reservados.
3. `GET /public/:slug/store` → si no existe, está `suspended` o fue eliminada: **404** sin distinguir el motivo en la respuesta.
4. El loader pide hero y primera página de productos; el injector SSR resuelve el tema y el color en el `<head>` antes del primer pintado.
5. Toda lectura de datos públicos pasa por el API; el navegador solo recibe HTML y assets.

**E. Media**

1. `<input type="file">` acepta JPG/PNG/WebP hasta 2 MB; se rechaza en cliente con mensaje en español.
2. Normalización en navegador (canvas/OffscreenCanvas): WebP full 1600 px de ancho máximo + thumb 600 px, reencode → EXIF y metadatos eliminados.
3. `POST` multipart al action same-origin → `packages/api-client` → `POST /panel/products/:id/images` (o `/panel/hero/:id`).
4. El API valida sesión, `store_id` de la sesión, tope de 8/10, tipo WebP real, dimensiones y tamaño por objeto. Sube a R2 con prefijo `stores/<storeId>/...` e inserta la fila.
5. La respuesta devuelve `r2_key` (base). Las URLs se construyen con `MEDIA_BASE_URL` del entorno; si no está configurada → 503 + log (no se inventa otro host).

**F. `/init` (primer admin)**

1. `console /init`: el formulario **no pide token**. La página está detrás de **Cloudflare Access** (aplicación self-hosted con path `init`); el console envía nombre, email y contraseña al api por service binding y no guarda secretos.
2. El API comprueba: **ningún** registro en `admin_users`, rate limit por IP. No hay token que validar: la barrera de acceso es Access en el edge.
3. Crea el admin, obliga a enrolar TOTP, entrega backup codes una sola vez y escribe `audit_log` (`admin.init`).
4. Cualquier llamada posterior responde **410 Gone**, con o sin Access. Sin UI de gestión de admins en el MVP.

> **Cambio 2026-11-18 (decisión del owner):** el alta deja de usar `INIT_TOKEN`. La protección pasa a **Cloudflare Access** sobre `console.tucatalogo.live/init`, y se mantienen el one-time (410), el rate limit y el `audit_log` (`admin.init`). **Por qué:** elimina un secreto que había que generar, distribuir a mano y rotar, y sustituye la comprobación en la aplicación por una barrera de identidad en el edge (Zero Trust), con política por email y registro de accesos. **Qué se pierde:** una barrera **independiente del edge**; si la aplicación de Access se desactiva o se le cambia el path por error, `/init` queda abierto hasta que exista un admin (después el 410 cierra el vector para siempre). Queda documentado en `docs/adr/0002-init-without-token.md`.

**G. Suspensión y reactivación**

1. Owner en `/panel-admin/settings`: `POST /panel/store/suspend` {reason} → `status = suspended`, `suspendedBy = owner`.
2. Console: `POST /console/stores/:id/suspend` {reason} → `suspendedBy = admin` + audit.
3. El storefront responde 404. **`/panel-admin` sigue accesible** para el dueño (si no, no podría reactivar) con banner que explica el estado y el motivo si es suspensión administrativa.
4. Reactivación: owner solo si `suspendedBy = owner` (si es `admin` → 403 con mensaje claro); console siempre. Audit en ambos casos.

**H. Borrado**

1. Owner: `/panel-admin/settings`, requiere contraseña + escribir el slug. Console: `DELETE /console/stores/:id` con slug de confirmación.
2. El API verifica permiso y confirmación, escribe `audit_log` y ejecuta: listar y borrar objetos R2 bajo `stores/<storeId>/` → borrar filas hijas y `store` → borrar `store_users` del dueño (cuenta incluida) → insertar `slug_reservation` con 90 días.
3. Respuesta 204. Sesiones de esa tienda invalidadas. Storefront 404 permanente.
4. Si el borrado de R2 falla, se aborta antes de tocar D1 y se devuelve 502 con log: nunca queda una tienda viva apuntando a imágenes borradas.

---

## 5. Árbol del monorepo (objetivo F1)

```
tucatalogo/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ routes/           # Route: HTTP, Zod, envelope, status
│  │  │  ├─ services/         # Service: reglas de negocio (sin Drizzle)
│  │  │  ├─ repositories/     # Repository: Drizzle/D1 + R2
│  │  │  ├─ middleware/       # requestId, auth, rate limit, errores
│  │  │  ├─ constants/        # usadas 2+ veces en esta app
│  │  │  ├─ libs/
│  │  │  └─ index.ts
│  │  └─ wrangler.jsonc
│  ├─ web/
│  │  ├─ app/
│  │  │  ├─ routes/           # storefront + panel-admin
│  │  │  ├─ components/
│  │  │  ├─ features/
│  │  │  └─ lib/              # resolución de host, injector
│  │  ├─ workers/             # entry de Workers
│  │  ├─ react-router.config.ts
│  │  └─ wrangler.jsonc
│  ├─ commercial/
│  │  ├─ app/routes/          # landing + registro
│  │  └─ wrangler.jsonc
│  └─ console/
│     ├─ app/routes/          # init, login, 2fa, tiendas
│     └─ wrangler.jsonc
├─ packages/
│  ├─ api-client/             # Hono RPC + adapter + dominio
│  ├─ config/                 # tsconfig, eslint, tailwind preset
│  ├─ db/
│  │  ├─ schema/              # Drizzle
│  │  ├─ migrations/          # versionadas
│  │  └─ seeds/               # SQL versionado (local/dev)
│  ├─ shared/
│  ├─ themes/                 # tokens, fuentes, metadata, motor OKLCH
│  ├─ types/                  # Zod + tipos
│  └─ ui/
├─ docs/                      # env.md, deploy.md, runbook.md (F7)
├─ .github/workflows/         # ci, deploy-prod, sync-secrets (F1/F7)
├─ pnpm-workspace.yaml
├─ PLAN.md
└─ AGENTS.md
```

Nota: `apps/*/app/routes` corresponde al layout de React Router framework mode; el entry de Workers y los ficheros de configuración se confirman en el spike F0 (§16) contra la versión estable instalada.

---

## 6. Esquema de base de datos

### 6.1 Convenciones

- `id`: `text` (UUID generado en app; Better Auth puede generar el suyo).
- Timestamps: `integer` epoch ms (`created_at`, `updated_at`). Nombres en `snake_case`.
- Booleanos: `integer` 0/1. Dinero: `integer` en unidad mínima.
- Sin `default` en columnas de estado o configuración: el service asigna el valor explícito (P1).
- D1 único por entorno (`dev`, `prod`). Esquema versionado en `packages/db/migrations`; el esquema **de negocio** es idéntico en local, dev y prod.
- Excepción operativa de seeds: **no hay datos seed versionados** (`packages/db/seeds` está vacío). La tienda local se crea con el flujo real de registro. El runner `pnpm db:seed:local` mantiene una tabla propia `_local_seed_history` (checksum SHA-256 de cada `*.sql` aplicado) para no reejecutarlo. Es **infraestructura local** (el runner fija `--local`), no se crea en prod y **no forma parte del esquema de negocio**.

### 6.2 Reino console (`admin_*`)

| Tabla | Campos clave | Constraints |
| --- | --- | --- |
| `admin_users` | `id`, `email`, `email_verified`, `name`, `image`, `two_factor_enabled`, `created_at`, `updated_at` | `email` único (normalizado a minúsculas) |
| `admin_sessions` | `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at` | `token` único; FK `user_id` → `admin_users` (cascade) |
| `admin_accounts` | `id`, `user_id`, `account_id`, `provider_id`, `password`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `created_at`, `updated_at` | FK cascade; único (`provider_id`, `account_id`). `password` es hash de Better Auth, nunca texto plano. Los campos OAuth son **nullable y no se usan en el MVP** (ver nota) |
| `admin_verifications` | `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` | Índice `(identifier)` |
| `admin_two_factor` | `id`, `user_id`, `secret`, `backup_codes`, `created_at`, `updated_at` | `user_id` único; FK cascade. `secret` y `backup_codes` cifrados/serializados por Better Auth. Los timestamps los pone la aplicación, **sin `DEFAULT` en DDL** (ver nota) |

### 6.3 Reino tienda (`store_*`)

| Tabla | Campos clave | Constraints |
| --- | --- | --- |
| `store_users` | `id`, `email`, `email_verified`, `name`, `image`, `created_at`, `updated_at` | `email` único (normalizado). **Sin** columnas ni tabla de 2FA (no aplica al dueño) |
| `store_sessions` | `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at` | `token` único; FK cascade |
| `store_accounts` | `id`, `user_id`, `account_id`, `provider_id`, `password`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `created_at`, `updated_at` | FK cascade; único (`provider_id`, `account_id`). Campos OAuth nullable, no usados en el MVP |
| `store_verifications` | `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` | Índice `(identifier)`; usado por OTP y reset |

Ninguna tabla se comparte entre reinos. El mismo email puede existir en `store_users` y en `admin_users`: son identidades distintas.

**Compatibilidad con Better Auth (F2):**

- El conjunto de columnas de cada tabla se valida contra la versión real de Better Auth instalada en F2; si esa versión espera un campo adicional, se añade con migración compatible antes de activar el flujo.
- `*_accounts` incluye los campos OAuth nullable (`access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`) para no romper el modelo `account` de Better Auth. En el MVP solo se usa `provider_id = 'credential'` con `password`; los OAuth quedan a `NULL` y ninguna ruta los lee ni los escribe.
- `admin_two_factor` mantiene `created_at`/`updated_at` con el valor puesto por la aplicación (sin `DEFAULT` en DDL), igual que el resto de timestamps del esquema.

### 6.4 `signup_intent`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `email` | text not null | Minúsculas; índice |
| `otp_hash` | text not null | Hash del código de 6 caracteres; **nunca el código en claro** |
| `attempts` | integer not null | Se incrementa en cada intento fallido; a los 5 el intent queda inválido |
| `expires_at` | integer not null | `now + 10 min` |
| `last_sent_at` | integer not null | Base del reenvío a 60 s |
| `consumed_at` | integer null | Marca de un solo uso |
| `ip_hash` | text null | Hash de IP para límites; sin IP en claro |
| `created_at` | integer not null | — |

**No guarda contraseña, ni nombre, ni slug.** El resto del payload del paso 1 permanece en el formulario del navegador y se reenvía (y revalida) en el POST final (§4.5 A). Los intents expirados se ignoran en lectura y se limpian por script de mantenimiento; **no** existe purga de tiendas.

### 6.5 `store`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `owner_id` | text not null | FK → `store_users.id` **sin `ON DELETE` (NO ACTION)**, **único** (una cuenta = una tienda). El borrado de tienda elimina `store` antes que `store_users`; un borrado accidental de la cuenta con tienda falla de forma visible en vez de arrastrar datos |
| `slug` | text not null | **Único**; formato `[a-z0-9-]`, sin reservados, sin cuarentena activa |
| `name` | text not null | — |
| `status` | text not null | `pending` \| `active` \| `suspended`. El flujo del MVP crea `active`; `pending` se conserva en el enum pero no lo produce ningún flujo |
| `suspended_by` | text null | `owner` \| `admin` |
| `suspended_reason` | text null | Obligatorio cuando `suspended_by = admin` |
| `suspended_at` | integer null | — |
| `theme_id` | text not null | Debe existir en `packages/themes`; validado al escribir |
| `primary_color` | text not null | Hex `#RRGGBB`; validado al escribir |
| `color_mode_default` | text not null | `light` (único admitido como valor por defecto en el MVP) |
| `currency` | text not null | `USD` \| `EUR` \| `COP` \| `VES` \| `ARS` |
| `plan` | text not null | **Sin `DEFAULT` en DDL**: el service asigna `free` en el MVP. Los valores de plan se fijan en F2 (Stripe/tiers) |
| `whatsapp_number` | text null | E.164 sin `+`; si es null el botón no se muestra |
| `whatsapp_message_template` | text null | Variables `{producto}`, `{precio}`, `{tienda}` |
| `logo_key` | text null | **Key** de R2, no URL |
| `created_at`, `updated_at` | integer not null | — |

Sin `isActive`. Checks:

- `status IN ('pending','active','suspended')`.
- Coherencia de suspensión: `status = 'suspended'` ⇔ `suspended_by IS NOT NULL`.
- `currency` y `color_mode_default` acotados por check.

### 6.6 `category`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `store_id` | text not null | FK → `store` (cascade) |
| `name` | text not null | — |
| `slug` | text not null | Único por tienda: `unique(store_id, slug)` |
| `sort_order` | integer not null | — |
| `created_at`, `updated_at` | integer not null | — |

### 6.7 `product`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `store_id` | text not null | FK → `store` (cascade) |
| `category_id` | text null | FK → `category.id` **on delete set null** (borrar una categoría no borra productos) |
| `name` | text not null | — |
| `slug` | text not null | Único **parcial** por tienda (ver 6.12) |
| `description` | text null | — |
| `price_minor` | integer not null | Unidad mínima; `>= 0`. **Sin `currency`**: se hereda de `store` |
| `is_active` | integer not null | 0/1; ocultar sin borrar |
| `is_deleted` | integer not null | 0/1; borrado lógico |
| `sort_order` | integer not null | — |
| `created_at`, `updated_at` | integer not null | — |

### 6.8 `product_image`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `product_id` | text not null | FK → `product` (cascade) |
| `r2_key` | text not null | **Base** del objeto; el full y el thumb se derivan (6.8.1) |
| `alt` | text not null | Obligatorio; el formulario no permite vacío |
| `width`, `height` | integer not null | Del full normalizado |
| `sort_order` | integer not null | Orden del carrusel |
| `created_at` | integer not null | — |

#### 6.8.1 Convención de keys (derivada, a confirmar en F0)

`r2_key = stores/<storeId>/products/<productId>/<random>` y los objetos son:

- `<r2_key>-full.webp` (1600 px de ancho máximo)
- `<r2_key>-thumb.webp` (600 px)

Se evita una columna extra y las keys son inmutables (cacheadas para siempre). El hero usa la misma convención con `image_desktop_key` / `image_mobile_key`.

### 6.9 `hero_slide`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `store_id` | text not null | FK → `store` (cascade) |
| `image_desktop_key` | text not null | Base R2 de la variante desktop |
| `image_mobile_key` | text not null | Base R2 de la variante mobile (recorte distinto, no es la misma imagen escalada) |
| `title`, `subtitle` | text null | — |
| `cta_label`, `cta_url` | text null | `cta_url` validada (https o ruta relativa); si falta uno de los dos, no se renderiza CTA |
| `sort_order` | integer not null | Hasta 10 slides por tienda (validado en service) |
| `is_active` | integer not null | 0/1 |
| `created_at`, `updated_at` | integer not null | — |

### 6.10 `slug_reservation`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `slug` | text not null | **Único** |
| `store_id` | text null | **Sin FK**: debe sobrevivir al hard delete de la tienda |
| `reason` | text not null | `deleted` en el MVP |
| `reserved_until` | integer not null | `now + 90 días` |
| `created_at` | integer not null | — |

La lista de slugs reservados (`www`, `api`, `panel`, `admin`, `console`, `app`, `mail`, `static`, `media`, `assets`, `cdn`, `commercial`, `tucatalogo`, `console-tucatalogo`, `tucatalogo-bucket`) es una **constante** en `packages/shared`, no filas de esta tabla. Aquí solo viven las cuarentenas temporales.

### 6.11 `audit_log`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | — |
| `actor_type` | text not null | `admin` \| `owner` \| `system` |
| `actor_id` | text null | Id del admin o del dueño |
| `store_id` | text null | Sin FK: el log sobrevive al borrado |
| `store_slug` | text null | Snapshot legible del slug |
| `action` | text not null | `admin.init`, `admin.login`, `admin.login_failed`, `store.suspend`, `store.reactivate`, `store.delete` |
| `target_type`, `target_id` | text null | — |
| `metadata` | text null | JSON acotado: motivo, resultado, contadores. **Sin PII sensible, sin tokens, sin OTP** |
| `ip_hash` | text null | Hash, no IP |
| `created_at` | integer not null | — |

Append-only: no hay endpoint de update ni delete. Índices en 6.12.

### 6.12 Índices y constraints

```
-- unicidad
store.slug                              UNIQUE
store.owner_id                          UNIQUE
category (store_id, slug)               UNIQUE
admin_users.email                       UNIQUE
store_users.email                       UNIQUE
slug_reservation.slug                   UNIQUE
admin_sessions.token / store_sessions.token  UNIQUE
admin_accounts (provider_id, account_id)     UNIQUE
store_accounts (provider_id, account_id)     UNIQUE
admin_two_factor.user_id                UNIQUE

-- unique parcial de producto
CREATE UNIQUE INDEX product_store_slug_uq
  ON product (store_id, slug)
  WHERE is_deleted = 0;

-- listados
product (store_id, is_deleted, is_active, sort_order)
product (store_id, category_id)
product_image (product_id, sort_order)
hero_slide (store_id, is_active, sort_order)
signup_intent (email)
signup_intent (expires_at)
slug_reservation (reserved_until)
audit_log (store_id, created_at DESC)
audit_log (actor_id, created_at DESC)
audit_log (action, created_at DESC)
```

### 6.13 Borrado y retención

| Operación | Efecto |
| --- | --- |
| Eliminar tienda | R2 `stores/<storeId>/*` → `product_image` → `product` → `category` → `hero_slide` → sesiones/cuentas/verificaciones de `store_users` → `store` → `store_users` → `slug_reservation(slug, +90 d)` → `audit_log`. En ese orden, dentro de lo que permita D1 por transacción |
| Suspender | Solo `status`, `suspended_by`, `suspended_reason`, `suspended_at`. Nada se borra |
| Eliminar producto | `is_deleted = 1` (lógico); las imágenes y objetos R2 se conservan hasta el borrado definitivo de la tienda |
| Eliminar imagen | Borra la fila y los dos objetos R2 (`-full`, `-thumb`) |
| Cuarentena | El slug queda libre automáticamente al pasar `reserved_until`; la tabla se consulta al validar disponibilidad |

---

## 7. Autenticación y sesiones

### 7.1 Dos reinos

| | Tienda | Console |
| --- | --- | --- |
| Tablas | `store_users`, `store_sessions`, `store_accounts`, `store_verifications` | `admin_users`, `admin_sessions`, `admin_accounts`, `admin_verifications`, `admin_two_factor` |
| Instancia Better Auth | `store` | `console` |
| Base path | `/auth/store/*` | `/auth/console/*` |
| Prefijo de cookie | `store` | `console` |
| Secreto | `BETTER_AUTH_SECRET_STORE` | `BETTER_AUTH_SECRET_CONSOLE` |
| Host | `slug.tucatalogo.live` | `console.tucatalogo.live` |
| 2FA | No | TOTP obligatorio + backup codes |
| Reset | Email (Resend) | Email (Resend) |
| UI de gestión | No | No (solo `/init`) |

Los nombres exactos de opciones (`cookiePrefix`, `advanced`, `basePath`, plugins) se confirman en F0 contra la versión instalada. Lo que **no** se negocia: dos instancias, dos secretos, cookies host-only, sin cookie de dominio padre.

### 7.2 Reglas de sesión

- Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, host-only. Nunca `domain=.tucatalogo.live`.
- Nombres reales: `store.session_token` y `console.session_token` en local; con prefijo `__Secure-` fuera de local. El challenge de login del console usa `console.two_factor` (10 min). El worker reenvía las cookies tal cual llegan (`getSetCookie()`), sin hardcodear el prefijo.
- **Console (M1):** la cookie `console.session_token` **solo** la emite `POST /auth/console/2fa/verify`. `/init`, `/2fa/setup` y el login con enrolamiento pendiente devuelven un `enrollmentToken` en el body y **ninguna** cookie de sesión.
- El worker que atiende el host reenvía el `Set-Cookie` del API tal cual; el navegador nunca ve un token en JS.
- Sesión de tienda: 7 días con renovación al usar. Sesión de console: 8 horas, sin renovación silenciosa más allá de ese límite (derivado).
- Logout invalida la fila de sesión en D1, no solo la cookie.
- Toda ruta de panel/console valida sesión en el **loader** (no en el cliente). Sin sesión → redirect; sesión de otro reino → 403.
- El API nunca confía en `store_id`, `user_id` ni `role` enviados por el cliente.

### 7.3 OTP de registro

| Regla | Valor |
| --- | --- |
| Formato | 6 caracteres |
| Vigencia | 10 minutos |
| Intentos | 5; al quinto fallo el intent queda inválido |
| Reenvío | Espera de 60 s y límite por hora |
| Almacenamiento | Hash en `signup_intent.otp_hash` |
| Uso | Único (`consumed_at`) |
| Anti-abuso | Turnstile en la petición de OTP + rate limit por email e IP |
| Enumeración | Respuesta idéntica exista o no el email |

El OTP verifica el correo, **no** crea sesión ni tienda por sí mismo: la creación ocurre en el POST final (§4.5 A).

### 7.4 `/init`

- `INIT_TOKEN` **deja de existir como secreto del worker** (cambio del 2026-11-18, decisión del owner): el alta se protege con **Cloudflare Access** sobre el path `init` de `console.tucatalogo.live` (aplicación self-hosted, política por email del owner). Decisión y consecuencias en `docs/adr/0002-init-without-token.md`; procedimiento en `docs/runbook.md`.
- Condición: `admin_users` vacía. Si ya hay un admin → **410 Gone**, con o sin Access. `GET /auth/console/init-status` informa si el alta sigue disponible.
- Crea el admin, exige enrolamiento TOTP antes de dar acceso, muestra los backup codes una sola vez y registra `audit_log` (`admin.init`).
- **No emite cookies.** Devuelve `{ admin, totpUri, backupCodes, enrollmentRequired: true, enrollmentToken }`; la sesión se obtiene en `/2fa/verify`.
- Rate limit propio. Sin UI para crear más admins en el MVP.
- Rotación del acceso al alta y del resto de secretos en el runbook (F7); el alta no tiene token que rotar.

### 7.5 2FA del console

- TOTP (app autenticadora) obligatorio para toda sesión de console.
- Backup codes de un solo uso, mostrados una única vez; se guardan cifrados por Better Auth.
- **Contrato M1 (implementado):**
  1. `/init` crea el admin y devuelve `totpUri`, `backupCodes` y un `enrollmentToken`; **sin cookies**.
  2. `/2fa/setup` re-emite el secreto TOTP pidiendo `{ email, password }` y devuelve otro `enrollmentToken`; **sin cookies**.
  3. `/2fa/verify` recibe `{ code, type, enrollmentToken }`. Si el enrolamiento está pendiente, el `enrollmentToken` viaja en el **body** (nunca como cookie), es de un solo uso y caduca a los 10 minutos (hash en `admin_verifications`).
  4. La cookie `console.session_token` **solo** sale de `/2fa/verify` (204). Usar el `enrollmentToken` como cookie devuelve 401.
  5. Tras verificar, `admin_two_factor.verified = 1`. `GET /console/*` exige además `verified = 1`: una sesión con `twoFactorEnabled` pero sin verificar responde 403 `TWO_FACTOR_REQUIRED`.
- Flujo de login normal: contraseña → challenge `console.two_factor` (10 min) → TOTP o backup code → sesión. Un intento fallido de 2FA cuenta para el límite.
- Reset de contraseña **no** salta el 2FA.

### 7.6 Recuperación de contraseña

- Enlace de un solo uso enviado por Resend; vigencia 30 minutos; hash en `*_verifications`.
- Misma respuesta siempre (no revelar si el email existe).
- Rate limit por email e IP. El token se invalida al usarse y al cambiar la contraseña.
- Console: el reset no permite entrar sin 2FA.
- Rutas de aterrizaje del enlace: console `/reset-password?token=…` (redirige a `/restablecer`); tienda `/panel-admin/reset-password?token=…`, con alias `/panel-admin/restablecer` (ambas implementadas en F5).

### 7.7 Rate limits (mínimos)

| Operación | Límite |
| --- | --- |
| Login tienda | 5 / 15 min por IP+email |
| Login console | 5 / 15 min por IP+email |
| 2FA verify | 5 / 15 min por sesión de challenge |
| OTP request | 3 / hora por email; 10 / hora por IP; 60 s entre envíos |
| OTP verify | 5 intentos por intent |
| Signup completo | 5 / hora por IP |
| Reset request | 3 / hora por email; 10 / hora por IP |
| Reset token (consumo) | 10 / 15 min por IP |
| `/init` | 5 / hora por IP |

**Implementación:** la capa **autoritativa es D1** (`rate_limit_counter`: ventana fija con UPSERT atómico y purga probabilística), con el sujeto hasheado en el bucket. Funciona con los bindings actuales del API y no necesita recursos extra. **Workers Rate Limiting binding queda post-MVP** (§19): no se promete ni se documenta como activo. Los límites se aplican en el API y un exceso responde `429` con `Retry-After`.

### 7.8 Aislamiento entre reinos y tiendas

- `store.owner_id` único: un dueño no puede tener dos tiendas.
- Login de tienda en el host B con credenciales de un dueño de A → 403; no se emite cookie.
- Endpoints `/panel/*` reciben `x-store-slug` (lo fija el worker que atiende el host; en dev/local ese worker resuelve antes el `?siteId`) + sesión, y verifican propiedad en cada request. El API nunca lee `?siteId`.
- Endpoints `/console/*` exigen sesión `admin` con 2FA completado; no aceptan cookies de tienda.
- Un admin del console **no** puede leer productos ni imágenes editables de una tienda; solo metadatos de la ficha (§11).
- Tests de aislamiento A/B obligatorios (§14).

---

## 8. API

### 8.1 Capas

```
routes/   → HTTP: parse Zod, status, envelope, requestId. Sin SQL.
services/ → reglas de negocio y permisos. Sin importar Drizzle.
repositories/ → Drizzle/D1 + R2. Devuelve modelos de dominio.
```

- Un service nunca recibe `storeId` del body: lo recibe del contexto resuelto (sesión o slug).
- Los errores de dominio son tipos explícitos (`NotFound`, `Forbidden`, `Conflict`, `Validation`, `Unavailable`); el route los mapea a status.
- Código compartido: 2+ usos en una app → `apps/api/src/{constants,libs}`; 2+ apps → `packages/shared`.

### 8.2 Endpoints

**Auth tienda**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/auth/store/slug-check?slug=` | Formato, reservados, ocupado, cuarentena. Devuelve motivo tipado |
| POST | `/auth/store/signup/otp` | Valida Turnstile + disponibilidad; crea `signup_intent`; envía OTP |
| POST | `/auth/store/signup` | Payload completo + código; crea usuario + tienda `active` de forma atómica |
| POST | `/auth/store/login` | Credenciales; verifica propiedad de la tienda del `Host` |
| POST | `/auth/store/logout` | Invalida sesión |
| GET | `/auth/store/session` | Sesión + tienda (para el loader) |
| POST | `/auth/store/password/forgot` | Envía enlace |
| POST | `/auth/store/password/reset` | Consume token y cambia contraseña |

**Auth console**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/auth/console/init-status` | 200 `{ available }`; la UI lo usa para cerrar `/init` |
| POST | `/auth/console/init` | One-time; 410 después; **sin cookies**; no recibe token (lo protege Cloudflare Access en `/init`); devuelve `enrollmentToken` |
| GET | `/auth/console/init-status` | `{ available }`; indica si el alta sigue abierta |
| POST | `/auth/console/login` | Contraseña; con 2FA verificado devuelve challenge `console.two_factor`; con enrolamiento pendiente devuelve `enrollmentToken` y **ninguna** cookie |
| POST | `/auth/console/2fa/setup` | `{ email, password }` → `totpUri`, `backupCodes`, `enrollmentToken`; **sin cookies** |
| POST | `/auth/console/2fa/verify` | `{ code, type, enrollmentToken? }`; **única** ruta que emite `console.session_token` (204) |
| POST | `/auth/console/logout` | — |
| GET | `/auth/console/session` | Exige 2FA verificado (`admin_two_factor.verified = 1`) |
| POST | `/auth/console/password/forgot` \| `/reset` | Email vía Resend |

**Panel (dueño, sesión `store`)**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET/PATCH | `/panel/store` | Datos, tema, color, moneda, WhatsApp |
| POST | `/panel/store/logo` | Subida a R2 → `logo_key` |
| POST | `/panel/store/suspend` | `{reason?}` → `suspended_by = owner` (motivo opcional) |
| POST | `/panel/store/reactivate` | Solo si `suspended_by = owner`, si no 403 |
| DELETE | `/panel/store` | `{password, confirmSlug}` |
| GET/POST | `/panel/products` | Listado con búsqueda y paginación / creación |
| GET/PATCH/DELETE | `/panel/products/:id` | `DELETE` es lógico (`is_deleted = 1`) |
| PATCH | `/panel/products/:id/status` | `is_active` 0/1 |
| PATCH | `/panel/products/reorder` | `{ ids }`, orden completo |
| POST | `/panel/products/:id/images` | Multipart full + thumb |
| PATCH/DELETE | `/panel/products/:id/images/:imageId` | Orden / borrado + R2 |
| PATCH | `/panel/products/:id/images/order` | `{ ids }`, reordenar el carrusel |
| GET/POST | `/panel/categories` | — |
| PATCH/DELETE | `/panel/categories/:id` | — |
| GET/POST | `/panel/hero` | — |
| PATCH/DELETE | `/panel/hero/:id` | — |
| PATCH | `/panel/hero/reorder` | Orden completo |
| POST | `/panel/hero/:id/images` | Multipart `desktop` + `mobile` (reemplazo del par) |
| POST | `/panel/hero/:id/images` | Reemplaza las dos imágenes del slide |

**Público (solo servidor, consumido por `web`)**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/public/:slug/store` | Tienda + tema + moneda + WhatsApp. 404 si no existe o está suspendida |
| GET | `/public/:slug/hero` | Slides activos ordenados |
| GET | `/public/:slug/products` | Filtro por categoría, búsqueda `q`, paginación de 24 |
| GET | `/public/:slug/products/:productSlug` | Solo `is_active = 1 AND is_deleted = 0` |
| GET | `/public/:slug/sitemap` | Slugs y `updated_at` para que `web` genere el XML |

**Console (sesión `admin`)**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/console/stores?q=&status=&page=` | Búsqueda por slug, nombre o email del dueño |
| GET | `/console/stores/:id` | Owner email, slug, status, fechas, nº productos, nº slides |
| POST | `/console/stores/:id/suspend` | `{reason}` obligatorio → `suspended_by = admin` + audit |
| POST | `/console/stores/:id/reactivate` | Siempre permitido + audit |
| DELETE | `/console/stores/:id` | `{confirmSlug}` → hard delete + cuarentena + audit |
| GET | `/console/audit?storeId=&action=&page=` | Solo lectura |

**Sistema**

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/health` | Valida env/config (incluida `MEDIA_BASE_URL`), D1 y media. 200 o 503 con detalle por check |
| GET | `/media/*` | **Solo local/development**: sirve los objetos de R2 bajo la key pedida, para que `MEDIA_BASE_URL` sea `http://127.0.0.1:9797/media`. En prod no se monta y responde 404; allí el host es el custom domain del bucket |
| GET | `/dev/outbox?to=<email>` | **Solo local con `EMAIL_DRIVER=memory`**: último correo de ese destinatario (`code` u `resetUrl`). Fuera de ese modo, 404 |
| GET | `/dev/outbox/last` | **Solo local con `EMAIL_DRIVER=memory`**: último correo emitido. Fuera de ese modo, 404 |

### 8.3 Envelope de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El slug ya está en uso.",
    "details": [{ "path": "slug", "message": "No disponible" }],
    "requestId": "01J..."
  }
}
```

| Código | HTTP | Uso |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod, tema/moneda inválidos al escribir |
| `UNAUTHORIZED` | 401 | Sin sesión o credenciales incorrectas |
| `FORBIDDEN` | 403 | Sesión de otra tienda/reino; reactivar suspensión admin |
| `NOT_FOUND` | 404 | Tienda, producto o slug inexistente |
| `CONFLICT` | 409 | Slug/email ocupado, cuarentena |
| `GONE` | 410 | `/init` ya consumido |
| `RATE_LIMITED` | 429 | Con `Retry-After` |
| `INTERNAL` | 500 | Fallo no previsto; mensaje genérico en español + `requestId` |
| `SERVICE_UNAVAILABLE` | 503 | Config faltante, D1/R2 no disponible |

Reglas: el `message` es apto para usuario final en español; los detalles técnicos van al log con el mismo `requestId`. Nunca se devuelve un stack ni un mensaje de D1.

### 8.4 Validación

- Contratos en `packages/types` (Zod), reutilizados por loaders/actions y por el API.
- Validar entrada en el route **y** en el service para reglas que dependen de datos (slug libre, topes, propiedad).
- Salidas tipadas; los tests validan que el shape coincide con el schema.
- Entrada inválida nunca produce 500.

### 8.5 Media

- Acepta solo WebP real (magic bytes, no solo `Content-Type`).
- Full ≤ 1600 px de ancho, thumb ≤ 600 px; peso por objeto ≤ 2 MB.
- Topes: 8 imágenes por producto, 10 slides por tienda; al exceder → 400.
- Keys aleatorias por tienda (§6.8.1). Sin nombres de usuario en la key.
- Las URLs públicas se forman como `MEDIA_BASE_URL` + `/` + key (sin barra final en la variable). Un solo valor por entorno; si falta → 503.
- La ruta dev-only `/media/*` sirve únicamente keys existentes bajo `stores/`: cualquier otro path o intento de traversal → 404.
- `Cache-Control: public, max-age=31536000, immutable` en R2 (keys inmutables).
- Un fallo de R2 en subida → 502 y no se inserta la fila.

### 8.6 Health y arranque

`/health` devuelve:

```json
{ "status": "ok", "checks": { "env": "ok", "d1": "ok", "media": "ok" }, "version": "..." }
```

- Falta de variable obligatoria → `503` + log de error con el nombre de la variable (nunca el valor), incluida `MEDIA_BASE_URL`.
- Fallo de D1 o de `MEDIA_BASE_URL` (ausente o mal formada) → `503`.
- Sin secretos ni detalles internos en la respuesta.

### 8.7 Logs

- Un `requestId` por request, devuelto en la respuesta y en el log.
- Se registra: `requestId`, método, path, status, `storeId`/`storeSlug` cuando exista, acción y duración.
- **Nunca**: contraseñas, códigos OTP, tokens, cookies, secretos, cuerpos completos, email en claro ni IP en claro (solo hash).
- Los fallos de configuración y de R2 se loguean como `error` y son la señal de alerta.

### 8.8 Rate limits

Se aplican en el **route**, antes de tocar el service, con los valores de §7.7. La única capa es **D1** (`rate_limit_counter`, ventana fija con UPSERT atómico); el sujeto va hasheado y el bucket no contiene email ni IP en claro. Un exceso devuelve `429` con `Retry-After` y no revela si el email o la tienda existen. Los límites de OTP se combinan con el contador de `signup_intent.attempts`, que vive en D1.

---

## 9. Frontend

### 9.1 Modelo

- React Router **v8 framework mode** en `web`, `commercial` y `console`; única versión fijada tras el spike F0.
- Server-first: datos en `loader`, mutaciones en `action` o resource route same-origin.
- Sin `fetch` del navegador al API. Sin TanStack Query. Sin estado global de servidor en el cliente.
- `basename` por app (`console` en su host; `web` sirve `/` y `/panel-admin`).

### 9.2 `packages/api-client`

- Cliente tipado con Hono RPC: importa **solo tipos** del `AppType` del API; no arrastra runtime del worker.
- Adapter de transporte:
  - producción/dev: `env.API.fetch(request)` (service binding);
  - local: `API_INTERNAL_URL` (`http://127.0.0.1:9797`) desde variable de entorno del dev server.
- Si no hay binding ni URL configurada → error explícito (`503`), nunca un cliente "vacío".
- Funciones de dominio en TS puro (`getStorefront(slug)`, `listProducts(...)`, `loginStore(...)`) que reciben el cliente y devuelven tipos de `packages/types`. Así los loaders no conocen detalles HTTP.
- Reenvía cookies en servidor (`Cookie` de entrada → API; `Set-Cookie` de salida → respuesta al navegador).

### 9.3 Sesión en el frontend

- El loader lee la cookie del request, la pasa al API y decide redirect. El cliente nunca decide si hay sesión.
- Acciones destructivas exigen confirmación en servidor (contraseña, slug, motivo), no solo un `confirm()`.
- Logout por acción POST, no por enlace GET.

### 9.4 Organización

- `packages/ui`: componentes globales (Button, Input, Dialog, Table, Toast, EmptyState, Skeleton…), variantes CVA con tokens semánticos.
- `apps/<app>/app/components`: composición específica de la app.
- `apps/<app>/app/features/<feature>`: lógica de UI + acciones de esa feature.
- Nada de componentes de dominio en `packages/ui`.

### 9.5 Estados y errores

- Toda ruta tiene estado de carga (skeleton o pending de navegación), vacío y error.
- `ErrorBoundary` por ruta + boundary global; 404 propio; 500 con mensaje en español y `requestId`.
- Los errores de validación vuelven al formulario campo por campo, accesibles (`aria-describedby`, foco en el primer error).
- Nunca una pantalla en blanco ni un spinner infinito.

### 9.6 Rendimiento

- SSR con streaming; el HTML del storefront no depende de JS para verse.
- Imágenes con `width`/`height` explícitos, `loading="lazy"` salvo el primer slide; `srcset` con full/thumb.
- Fuentes self-hosted con subset latino y `font-display: swap`; preload solo de las dos variantes usadas en el primer viewport.
- Sin JS de cliente para secciones estáticas (landing, ficha de producto salvo el carrusel).
- Presupuesto: Lighthouse móvil ≥ 90 en rendimiento y accesibilidad (§15).

### 9.7 Turnstile y legales

- Widget en el paso de OTP del registro; verificación en servidor contra `TURNSTILE_SECRET_KEY`.
- Falta de token o fallo de verificación → 400 con mensaje en español; nunca "continuar igual".
- Enlaces a `/terminos` y `/privacidad` en el registro y en el pie de la landing.

---

## 10. UI y temas

### 10.1 Stack

- **Radix UI** (primitivas accesibles) + **CVA** (variantes) + **Tailwind v4** (tokens como variables CSS).
- Sin librería de componentes opaca: los componentes globales viven en `packages/ui` y se componen en cada app.
- Los tokens son la única fuente de color, tipografía, radios, bordes y sombras. Ningún color "suelto" en componentes.

### 10.2 Tokens semánticos

Cada tema define el mismo conjunto de tokens; los componentes solo usan tokens.

```
--color-bg, --color-surface, --color-surface-2
--color-text, --color-text-muted, --color-text-inverse
--color-primary, --color-on-primary, --color-primary-hover, --color-primary-subtle
--color-accent, --color-accent-on
--color-border, --color-border-strong, --color-ring
--color-price, --color-whatsapp, --color-on-whatsapp
--color-success, --color-warning, --color-danger
--font-heading, --font-body
--radius-sm|md|lg|full
--border-width, --shadow-sm|md|lg
```

Regla de variantes: cada variante de componente declara **qué tokens usa**; el tema los sobrescribe. Una variante no puede introducir un hex directo.

### 10.3 Los 5 temas de tienda

| Tema | Base | Carácter | Radios / bordes | Tipografía |
| --- | --- | --- | --- | --- |
| **Rosé** (default) | `#C09299` | Femenino, suave, redondeado | Grandes, sombras difusas | Sans humanista + display suave |
| **Nude Studio** | Neutros cálidos | Minimal, editorial, elegante | Finos, casi sin sombra | Serif elegante en títulos |
| **Velvet Noir** | Oscuro con acentos dorados | Glam, nocturno | Pequeños, bordes definidos | Display de alto contraste |
| **Sol de Verano** | Vivos y cálidos | Alegre, juvenil | Muy grandes | Sans amigable, redondeada |
| **Urban Slate** | Grises + azul pizarra | Masculino, sobrio | Mínimos, esquinas rectas | Sans geométrica, condensada en títulos |

- Cada tema existe en **claro y oscuro** (10 combinaciones) y comparte layout y grilla con los demás.
- Cambian: paleta, tipografías, radios, bordes, sombras, estilo de botones y tarjetas.
- No cambian: estructura de home, grilla de productos, orden de la ficha, navegación.
- `packages/themes` exporta: tokens por tema y modo, fuentes self-hosted, y metadata para el picker (nombre, descripción, muestra de color).
- Afinado de los 5 temas con la skill `ui-ux-pro-max` (disponible y verificada en `skills-lock.json`).

### 10.4 Superficies de administración

| Superficie | Estilo | Acento |
| --- | --- | --- |
| `/panel-admin` | Neutro, densidad media, mobile-first | Color principal de la tienda como acento (nunca como fondo de texto) |
| Console | Neutro, densidad alta, tablas | Neutro; color de estado para `active`/`suspended` |
| Commercial | Neutro orientado a conversión | CTA deep rose `#8E5F67` con texto blanco; `#C09299` como acento de marca |

### 10.5 Theme injector (SSR)

- Se resuelve en el servidor, por request: tienda → `theme_id` + `primary_color` + modo (cookie) → tokens finales.
- Salida: `<style>` con `:root` (o `[data-theme="..."]` y `[data-color-mode="dark"]`) en el `<head>`, antes de cualquier contenido.
- También fija `color-scheme` para que los controles nativos acompañen.
- Sin CSS-in-JS en cliente, sin flash, sin `useEffect` para el color.
- Si el tema o el color no existen al leer → 500 + log (P1), nunca un tema por defecto.
- `/panel-admin` usa el tema neutro de administración con el color de la tienda como acento; no hereda la tipografía decorativa del storefront.

### 10.6 Motor de color OKLCH

Entrada: color principal del cliente (hex `#RRGGBB`) + tema + modo.

1. sRGB → OKLCH.
2. Derivar `primary`, `hover`, `subtle`, `ring`, `on-primary` y `accent` manteniendo el tono.
3. Ajustar `L`/`C` hasta cumplir contraste: **4.5:1** para texto normal, **3:1** para texto grande y elementos de UI (WCAG AA).
4. `on-primary` se elige por contraste real (blanco o casi negro), no por preferencia estética.
5. Determinista y puro: mismas entradas → mismas salidas (testeable en unit).

Errores: color inválido al escribir → **400**; valor corrupto en D1 al leer → **500 + log**. Sin fallback silencioso a un tema o color por defecto.

### 10.7 Oscuro

- Claro por defecto.
- Preferencia en cookie host-only por tienda, leída en el servidor → el HTML ya sale en el modo correcto (sin parpadeo).
- El selector visible se renderiza en el servidor con el estado actual; el cambio es un POST/action que persiste la cookie y recarga.
- Contraste AA verificado en los 10 pares tema/modo.

### 10.8 Colores que impulsan ventas

Reglas transversales del storefront:

- CTA de alto contraste; nunca pasteles de bajo contraste en acciones.
- Precio y CTA visibles sin scroll en la ficha (móvil).
- WhatsApp con token propio (`--color-whatsapp`) y contraste AA; el icono no sustituye al texto.
- El color del cliente no puede degradar el CTA: el motor lo ajusta y, si el resultado no alcanza AA, se oscurece/aclara el derivado (no se ignora el color).
- Badges de estado (agotado no aplica: sin stock en el MVP) y precios siempre legibles sobre la superficie real.

### 10.9 Fuentes

- Self-hosted en `packages/themes` (sin Google Fonts en producción), subset latino, `woff2`.
- `font-display: swap`; preload solo de las variantes del primer viewport.
- Licencias OFL/compatibles documentadas junto a los archivos.
- La selección final de familias se hace con `ui-ux-pro-max` y se cierra en F0/F4.

---

## 11. Console (backoffice SaaS)

### 11.1 Alcance

**Dentro:** login/logout/sesión, listar y buscar tiendas, detalle, suspender con motivo, reactivar, eliminar con confirmación, audit log, `/init`, 2FA, reset por email.

**Fuera:** impersonar, editar productos/hero/settings de una tienda, planes/tiers, métricas o dashboard analítico, gestión de admins, invitaciones, roles.

### 11.2 Rutas y UI

| Ruta | Contenido |
| --- | --- |
| `/init` | Formulario **sin token** (detrás de Cloudflare Access, path `init`) + creación del primer admin + enrolamiento TOTP + backup codes |
| `/login` | Email + contraseña |
| `/2fa` | Código TOTP o backup code; completa el enrolamiento con el `enrollmentToken` del body |
| `/recuperar`, `/restablecer` (alias `/reset-password`) | Reset por email |
| `/` | Listado: búsqueda por slug/nombre/email, filtro por `status`, paginación |
| `/tiendas/:id` | Detalle: owner email, slug, status, `suspendedBy`/`reason`, fechas, nº productos, nº slides, acciones |
| `/auditoria` | Entradas recientes con filtro por tienda y acción |

- Tabla densa, mobile-first con cards en pantallas pequeñas.
- Acciones destructivas con diálogo + texto de confirmación (escribir el slug) y motivo obligatorio al suspender.
- Estados de carga, vacío y error en listado, detalle y audit.
- El detalle **no** expone productos ni imágenes editables: solo conteos y metadatos.

### 11.3 Reglas

- Toda ruta salvo `/init`, `/login`, `/2fa`, `/recuperar`, `/restablecer` y el alias `/reset-password` exige sesión `admin` con 2FA verificado (`admin_two_factor.verified = 1`).
- `/init` deja de existir funcionalmente (410) en cuanto hay un admin.
- Suspender exige `reason` no vacío; reactivar no lo exige.
- Eliminar exige escribir el slug exacto; el API lo verifica de nuevo.
- Cada acción escribe `audit_log` con actor, tienda y resultado.
- Sin UI de gestión de admins: el único admin se crea por `/init`.

---

## 12. Errores y no fallbacks

Regla: **ningún fallo se oculta con un valor por defecto**. Si falta algo, se falla de forma visible, controlada y registrada.

| Situación | Comportamiento | Status |
| --- | --- | --- |
| Falta una variable de entorno obligatoria | `/health` falla, log de error con el nombre de la variable, la operación no se ejecuta | 503 |
| D1 no disponible o migración pendiente | Log de error; sin respuestas parciales | 503 |
| `MEDIA_BASE_URL` no configurada | Sin URLs inventadas; log de error | 503 |
| `MEDIA_BASE_URL` mal formada (sin esquema, con barra final doble) | Falla la validación de arranque; log de error | 503 |
| El host de media no responde al servir una imagen | El navegador recibe el error de ese único host; la app no reescribe la URL a otro | 5xx del host |
| R2 no responde al borrar (borrado de tienda) | Se aborta antes de tocar D1 | 502 |
| `theme_id` desconocido al leer | Log de error + alerta; no se aplica un tema por defecto | 500 |
| `theme_id` desconocido al escribir | Rechazo con mensaje en español | 400 |
| `currency` inválida al escribir | Rechazo | 400 |
| `primary_color` inválido al escribir | Rechazo | 400 |
| Color o moneda corruptos en D1 (lectura) | Log de error + alerta | 500 |
| Binding del API ausente | Error explícito en la app | 503 |
| Turnstile no disponible | El registro no continúa | 503 |
| Resend falla al enviar OTP | Mensaje de reintento; el intent no se marca como enviado | 502 |
| Slug inválido o reservado | 404 en storefront / 400 en formulario | 404/400 |
| Wildcard intercepta el host de R2 | Gate de F0: **imposible por diseño** (el wildcard está en la subzona, el bucket en el padre); se mantiene `curl` de regresión | - |
| Tienda suspendida | 404 en storefront (sin revelar el motivo); `/panel-admin` sigue accesible con banner | 404 |
| Reintentar suspensión ya suspendida | Idempotente, actualiza motivo y audita | 200 |
| Sin número de WhatsApp | El botón no se muestra (estado nulo previsto, no fallback) | — |
| Sin logo | Se muestra el nombre de la tienda como texto, no una imagen de relleno | — |
| Sin slides de hero | Se muestra la grilla de productos sin carrusel (estado vacío previsto) | — |

Errores de entrada = 4xx. Errores graves (config, infraestructura, corrupción) = 5xx. Nunca 500 por una entrada inválida (P5) y nunca 200 ocultando un fallo.

---

## 13. CI/CD

### 13.1 Workers y entornos

| Worker | dev | prod |
| --- | --- | --- |
| `api` | `tucatalogo-api-dev` | `tucatalogo-api-prod`, sin ruta pública |
| `web` | `tucatalogo-web-dev` + `?siteId` | rutas `*.tucatalogo.live/*` |
| `commercial` | `tucatalogo-commercial-dev` | `tucatalogo.live/*` |
| `console` | `tucatalogo-console-dev` | `console.tucatalogo.live/*` |

Nombres reales en `wrangler.jsonc`: `tucatalogo-{api,web,commercial,console}-{dev,prod}`. Cada app tiene `env.dev` y `env.prod`; local = `wrangler dev` con D1 y R2 locales y la api en el puerto `9797`. `dev` no usa wildcard: el frontend resuelve `?siteId` y lo manda al API como `x-store-slug`. En local los frontends escuchan en `web` 5173, `commercial` 5174 y `console` 5175, y el correo usa `EMAIL_DRIVER=memory` (outbox en `GET /dev/outbox`) o `console`; `resend` es el único driver de dev/prod.

`workers_dev` / `preview_urls`: el **api** los tiene a `false` siempre (sin host público en ningún entorno); `web`, `commercial` y `console` usan `workers_dev: true` en `env.dev` (smoke de CI) y `false` en `env.prod`; `preview_urls` es `false` en todos.

### 13.2 Workflows (implementados, sin ejecutar en cloud)

Modelo **prod-only**: no hay workflow de dev. Los workflows de prod usan el
**GitHub Environment `prod`**, que **no tiene reglas de protección ni
aprobaciones**: agrupa los 4 runtime secrets del api y las variables del destino,
no añade un paso humano. El deploy sigue siendo automático en cada push a la línea
principal.

| Workflow | Disparador | Environment | Pasos |
| --- | --- | --- | --- |
| `ci.yml` | PR y push a `main` | — | install con lockfile → lint → typecheck → test → build; no despliega |
| `deploy-prod.yml` | push a `master`/`main` o `workflow_dispatch` | `prod` (+ 2 repository secrets de Cloudflare) | install → check A1 → `pnpm audit --prod --audit-level=high` → lint → typecheck → test → build → migraciones D1 prod → deploy api → web → commercial → console → deployment/D1 del API → smoke prod con `SMOKE_STORE_HOST` |
| `sync-secrets.yml` | **solo `workflow_dispatch`** (input `target` = `prod` + `confirm` = `sync`) | `prod` | install → `wrangler secret put <NAME> --env prod` para los 4 runtime secrets del api |

- Un solo deploy con `concurrency: deploy-cloud` y `cancel-in-progress: false`: un deploy en curso no se corta.
- `pnpm audit --prod --audit-level=high` corre en el workflow: una vulnerabilidad high/critical (o un fallo de la consulta) detiene el deploy de forma visible. Las excepciones van en `pnpm-workspace.yaml` → `auditConfig.ignoreGhsas` con su motivo escrito (pnpm 10: `ignoreGhsas` para GHSA, `ignoreCves` para CVE) y se retiran en cuanto haya parche. Hoy hay una: `GHSA-fc5q-39xc-vjpf` (picomatch vía `better-auth > vitest`, dev-only, sin versión parcheada).
- Un fallo de migración detiene el deploy antes de desplegar código.
- **API sin host público:** el smoke no puede hacer `curl` a `/health` del API. El workflow comprueba `wrangler deployments status` (deployment activo) y `d1 execute … SELECT 1` (D1 remoto); `/health` del API se ejercita en tests y en local. Un smoke real por service binding requiere una ruta en un frontend que llame al API (trabajo de F7 de las apps).
- **Credenciales en dos niveles:** `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` son *repository secrets* (accesibles desde cualquier job con Environment); los 4 runtime secrets del api son *Environment secrets* de `prod`; `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST` son *Environment variables* de `prod` (`SMOKE_STORE_HOST` también vale a nivel de repo). El Environment `dev` existe y no se usa.
- **`SMOKE_STORE_HOST` con fallback de CI:** si la variable no existe, el smoke apunta a `demo.tucatalogo.live` para no tumbar el deploy. Es un fallback de CI, no de runtime: el owner debe crear la variable cuando tenga una tienda real de bajo riesgo.
- **Secretos ≠ deploy:** `wrangler deploy` no aplica secretos. `deploy-prod.yml` es **solo deploy** y no duplica el sync; los 4 runtime secrets del api se aplican con el workflow **manual** `sync-secrets.yml` (`wrangler secret put --env prod`). Ojo con la homonimia: `--env prod` es el entorno de **Wrangler**, `environment: prod` es el de **GitHub**.
- **Control de acceso del alta:** `/init` no tiene token; lo protege una aplicación de **Cloudflare Access** (Zero Trust) sobre `console.tucatalogo.live/init`. Debe estar activa **antes** de desplegar la versión sin token; el resto del console (login, `/2fa`, panel) no pasa por Access.
- **Estado real:** `ci.yml` corre en PR/push; `deploy-prod.yml` y `sync-secrets.yml` se han ejecutado. Recursos creados: zona `tucatalogo.live`, D1 `tucatalogo-prod` (`ed32bca0-2ed9-4a07-97e5-018e8a15049f`) y R2 `tucatalogo-media-prod`.
- Scripts reales: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:migrate:local` y `pnpm db:seed:local`. Las migraciones remotas se ejecutan con `wrangler d1 migrations apply <db> --remote --env <env>` desde el workflow (no hay script `db:migrate:<env>`).

### 13.3 Migraciones

- Versionadas en `packages/db/migrations`; se aplican con `wrangler d1 migrations apply <db> --remote --env <env>` desde `apps/api` (así lo hacen los workflows).
- Siempre compatibles hacia atrás (expand/contract): primero añadir, desplegar, luego retirar en una release posterior.
- Prohibido borrar o renombrar columnas en la misma release que cambia el código que las usa.
- `prod` solo aplica esquema: **sin seeds**. `dev` tampoco recibe seeds en el MVP. El runner `pnpm db:seed:local` es local (fija `--local`), usa la tabla operativa `_local_seed_history` (§6.1) y hoy no hay ningún `*.sql`: no existen datos seed.
- El primer admin **no** es seed: se crea con `/init`.

### 13.4 Orden de deploy

1. Migraciones de prod.
2. `api` (nuevo contrato).
3. `web`, `commercial`, `console` (pueden ir en paralelo; consumen el contrato nuevo).
4. Smoke: `/health` a través de cada frontend + una ruta pública + login de prueba.

El API va primero porque los frontends consumen su contrato; nunca al revés. El
deploy es prod-only: no hay automatización de `env.dev`.

**Secretos:** el primer día, después del deploy inicial del `api`, se lanza a mano
el workflow `sync-secrets` (`target: prod`, `confirm: sync`) porque el worker debe
existir para recibir `wrangler secret put`. En rotaciones basta con repetirlo: el
deploy automático no toca secretos y no los borra.

### 13.5 Secretos y variables

| Variable / secreto | Dónde | Quién lo define |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret de GitHub | Owner del repo |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret de GitHub | Owner del repo |
| `BETTER_AUTH_SECRET_STORE` | Environment secret (`prod`) → Worker secret (**solo** `api`), por `sync-secrets` | Owner, distinto por entorno |
| `BETTER_AUTH_SECRET_CONSOLE` | Environment secret (`prod`) → Worker secret (**solo** `api`), por `sync-secrets` | Owner, distinto por entorno |
| `RESEND_API_KEY` | Environment secret (`prod`) → Worker secret (api), por `sync-secrets` | Owner |
| `TURNSTILE_SECRET_KEY` | Environment secret (`prod`) → Worker secret (api), por `sync-secrets` | Owner |
| `SMOKE_STORE_HOST` | Environment variable (`prod`) —también admite Repository variable— (no secreta) | Owner: host de la tienda de bajo riesgo para el smoke de prod. Sin ella el workflow usa `demo.tucatalogo.live` |
| `TURNSTILE_SITE_KEY` | Variable pública de `apps/commercial/wrangler.jsonc` (`env.prod`); copia informativa como Environment variable (`prod`) | Owner; no es secreta. El valor que usa el widget es el del `wrangler.jsonc` |
| `MEDIA_BASE_URL` | Variable por entorno (**un solo valor**) | Owner. Valores en el cuadro siguiente |

Los 4 runtime secrets se guardan **una vez** como *Environment secrets* del GitHub
Environment `prod` y se aplican al worker con el workflow **manual**
`sync-secrets.yml` (`wrangler secret put <NAME> --env prod`). Es manual a propósito:
`wrangler deploy` no aplica secretos, y escribir secretos en cada push no aporta
nada. El Environment `prod` no tiene reglas de protección ni aprobaciones: agrupa
secretos y variables por destino. El Environment `dev` existe y no se usa.

El console **no** guarda secretos de auth ni de alta: el formulario `/init` no envía ningún token y la única barrera de acceso es la aplicación de **Cloudflare Access** delante de `console.tucatalogo.live/init` (ver ADR 0002). Un `INIT_TOKEN` huérfano en el worker se elimina con `wrangler secret delete INIT_TOKEN --env prod`; ya no se lee ni se rota.

**Valores de `MEDIA_BASE_URL`:**

| Entorno | Valor |
| --- | --- |
| `prod` | `https://bucket.tucatalogo.live` |
| `local` | `http://127.0.0.1:9797/media` (ruta dev-only del api) |
| `dev` | Un único valor explícito por entorno: el host público del bucket de dev **o** la ruta media del worker dev. Nunca ambos |

Sin barra final. Es la única fuente de verdad para URLs de imágenes: no hay segunda variable de media ni host de reserva.

Detalle completo por app y entorno en `docs/env.md` (entregable de F7). Rotación en `docs/runbook.md`.

**Configuración no secreta del API fijada en código:** `EMAIL_DRIVER` (`memory` \| `console` solo local; `resend` en dev/prod), `TURNSTILE_MODE` (`test`/`disabled` solo local, `enabled` fuera), `STORE_ORIGIN_TEMPLATE` y `CONSOLE_ORIGIN`. Viven en `wrangler.jsonc` por entorno, no son secretos y no admiten valores por defecto.

### 13.6 Smoke y rollback

- Smoke prod: `/health` de web (con `SMOKE_STORE_HOST`), commercial y console, una tienda real de bajo riesgo y login del console sin ejecutar acciones destructivas.
- Smoke dev: no existe. `deploy-dev.yml` se eliminó al pasar a prod-only; `env.dev` solo se despliega a mano si el owner lo pide.
- Rollback de código: `wrangler rollback <nombre-del-worker>` (p. ej. `tucatalogo-web-prod`), primero los frontends y luego el api si el problema es de contrato (o el api primero si el contrato nuevo rompe a los antiguos).
- Rollback de datos: D1 Time Travel para restaurar la base; **no** restaura R2. Un borrado de tienda es definitivo (v1.0 §11), por eso la confirmación es estricta.
- Toda release debe poder convivir con la versión anterior del otro lado del binding durante la ventana de deploy.

### 13.7 Endurecimiento y cabeceras

- **`workers_dev` / `preview_urls`:** `api` en `false` siempre (sin host público); `web`, `commercial` y `console` con `workers_dev: true` en `env.dev` (necesario para el smoke) y `false` en `env.prod`; `preview_urls: false` en todos. Lo verifica el check **A1** (`node packages/config/scripts/check-worker-configs.mjs`) en CI y en ambos deploys.
- **Cabeceras de seguridad** (`packages/shared`, aplicadas por los worker entries; nunca sobrescriben `cache-control`, `set-cookie` ni una CSP existente):
  - `x-content-type-options: nosniff` y `permissions-policy: camera=(), microphone=(), geolocation=(), payment=()`.
  - `referrer-policy: no-referrer` en console y `/panel-admin`; `strict-origin-when-cross-origin` en storefront y commercial.
  - `x-frame-options: DENY` + `frame-ancestors 'none'` en console y `/panel-admin`; `SAMEORIGIN` en storefront y commercial.
  - `strict-transport-security: max-age=31536000; includeSubDomains` **solo** con `ENVIRONMENT=production`.
- **Turnstile:** `TURNSTILE_MODE=test` (claves de prueba, sin red) o `disabled` **solo en local**; `disabled` fuera de local es fallo de configuración (503). `enabled` exige `TURNSTILE_SECRET_KEY` y usa `siteverify`. `test` en dev/prod no es un modo válido.

---

## 14. Testing

| Nivel | Qué cubre | Herramienta | Dónde corre |
| --- | --- | --- | --- |
| Unit | Motor OKLCH y contraste AA, validadores de slug, formato de precio/moneda, plantilla de WhatsApp, schemas Zod | Vitest | CI (PR) |
| Integración API | Endpoints contra D1 local, envelopes de error, permisos por reino, cuarentena de slug, topes 8/10 | Vitest + D1 local | CI (PR) |
| Aislamiento | Usuario A no lee ni escribe datos de la tienda B; cookie de tienda no abre console y viceversa; login en host ajeno → 403 | Vitest + Playwright | CI (PR) y dev |
| OTP negativo | Expirado, 5 intentos, reenvío antes de 60 s, código incorrecto, intent ya consumido, rate limit | Integración | CI (PR) |
| E2E | Registro → OTP → login → productos → hero → tienda pública → WhatsApp; reset de contraseña | Playwright | dev en cada deploy |
| Console | `/init` one-time (segundo intento 410), login con 2FA, backup code, suspender/reactivar, owner bloqueado tras suspensión admin, eliminar + audit + cuarentena | Playwright + integración | dev |
| No-fallback | Variable faltante → 503 + log (incluida `MEDIA_BASE_URL`); tema corrupto en lectura → 500 + log; nunca 200 silencioso | Integración | CI (PR) |
| Accesibilidad y rendimiento | Lighthouse móvil ≥ 90 (rendimiento y accesibilidad) en home y ficha; axe sin violaciones críticas en las 3 superficies | Lighthouse CI + axe | dev y prod |
| Seguridad | Revisión de auth, cookies, subida de archivos, CORS, secretos | `security-reviewer` | Por hito de auth/API |

Regla: ningún test depende de datos de producción. Los E2E crean sus propias tiendas y las limpian.

**Ejecución:** Vitest 4.1 con `@cloudflare/vitest-plugin` 1.8.3 (sucesor de `@cloudflare/vitest-pool-workers`) en `apps/api`: corre dentro del runtime de Workers con D1/R2 locales y migraciones inyectadas, sin leer `.dev.vars` ni la red. `packages/db` genera migraciones con `pnpm --filter @tucatalogo/db generate`. Ver `docs/adr/0001-f0-stack-decisions.md`.

---

## 15. Criterios de aceptación

### 15.1 Los 13 del baseline, ajustados

| # | Criterio | Verificación |
| --- | --- | --- |
| 1 | Registro en commercial → OTP → tienda `active` accesible en `slug.tucatalogo.live` en prod, sin intervención manual | E2E en dev + prueba manual en prod |
| 2 | Login en `/panel-admin`, 10 productos con varias imágenes, hero con 2+ slides (desktop y mobile) visibles en la tienda | E2E + revisión visual |
| 3 | Recuperación de contraseña de extremo a extremo | E2E con bandeja de prueba |
| 4 | Cambio de tema y color principal: los 5 temas en claro y oscuro, sin parpadeo | Revisión + captura de HTML inicial (CSS en `<head>`) + axe |
| 5 | Cambio de moneda y enlace de WhatsApp correcto con el mensaje configurado | Unit de plantilla + E2E |
| 6 | Suspender → 404 público; eliminar → datos e imágenes borrados | E2E + verificación en D1/R2 |
| 7 | Aislamiento: A no puede leer ni escribir datos de B | Suite de aislamiento |
| 8 | OTP y login con casos negativos: expiración, intentos, reenvíos, rate limit | Suite negativa |
| 9 | CI despliega a **prod** en cada push a `master`/`main` (automático, sin aprobación), aplicando migraciones antes del código | Ejecución real de `deploy-prod.yml` |
| 10 | Service bindings funcionan en dev y prod, sin llamadas públicas entre workers | Revisión de rutas + smoke |
| 11 | Lighthouse móvil ≥ 90 en rendimiento y accesibilidad; AA en los 5 temas y ambos modos | Lighthouse CI + axe |
| 12 | Slug inexistente o reservado → 404 o error controlado, nunca 500 | Integración + E2E |
| 13 | README con setup local, variables y deploy + E2E Playwright verde del flujo registro → panel → tienda | Revisión del README + CI |

### 15.2 Console

| # | Criterio |
| --- | --- |
| 14 | `/init` está cerrado por Cloudflare Access antes del primer admin, funciona una sola vez (después 410), exige 2FA TOTP, login/logout y reset por email funcionan |
| 15 | Listar, buscar y ver detalle; suspender con motivo y reactivar; el owner **no** puede reactivar una suspensión administrativa |
| 16 | Eliminar tienda con confirmación, deja `audit_log` y cuarentena de slug de 90 días |
| 17 | Aislamiento console/store: la cookie del console no abre `/panel-admin` y la de tienda no abre el console |

### 15.3 No fallback

| # | Criterio |
| --- | --- |
| 18 | Con R2 o configuración obligatoria fallando, la respuesta es 500/503 con log; no hay host alternativo, ni tema por defecto, ni placeholder que oculte el fallo |

**Regla de parada del MVP:** los 13 del baseline + los 4 de console (14–17) + el 18 (no fallback) aprobados. Con eso se congela el alcance y todo lo demás pasa al backlog (§19).

---

## 16. Fases

| Fase | Días | Depende de | Entregables | Delegación |
| --- | --- | --- | --- | --- |
| **F0 – Spikes** | 4–5 | — | ADRs y pruebas de: (1) React Router v8 + plugin de Cloudflare/Vite; (2) dos instancias Better Auth sobre D1 con cookies relayadas, `/init` y 2FA TOTP; (3) custom domain de R2 vs wildcard; (4) injector SSR + motor OKLCH; (5) driver de email de prueba; (6) contador de rate limit en D1 | `platform-engineer`, `auth-specialist`, `theme-designer` |
| **F1 – Monorepo** | 2–3 | F0 | pnpm workspaces, paquetes vacíos con contratos, 4 apps × dev/prod en `wrangler.jsonc`, CI base, esquema + migraciones + seeds, scripts | `platform-engineer`, `db-architect` |
| **F2 – API + auth** | 6–7 | F1 | Capas Route/Service/Repository, dos reinos, signup + OTP + reset, API de console, R2 + media, borrado, rate limits, tests de integración | `api-dev`, `auth-specialist`, `db-architect` |
| **F3 – Commercial** | 3–4 | F2 (parcial) | Landing neutra orientada a conversión, registro de 4 pasos, slug check en vivo, preview de tema, OTP, confirmación, Turnstile, términos y privacidad | `commercial-dev`, `theme-designer` |
| **F4 – Web + temas** | 6–8 | F2, F1 (themes) | Resolución por host, 404, 5 temas × 2 modos, injector, motor OKLCH, home con hero, grilla, filtros, búsqueda, paginación 24, ficha, WhatsApp, SEO/sitemap, performance | `web-dev`, `theme-designer` |
| **F5 – Panel-admin** | 7–9 | F2, F4 | Login/reset, layout, dashboard, CRUD de productos con imágenes, categorías, hero, settings, suspender/eliminar, estados | `panel-dev`, `theme-designer` |
| **F6 – Console** | 4–5 | F2 | `/init`, login 2FA, forgot/reset, layout, listado/detalle, suspender/reactivar/eliminar, audit | `panel-dev`, `auth-specialist` |
| **F7 – Hardening** | 4–5 | F3–F6 | E2E completos, aislamiento, OTP negativo, no-fallback, Lighthouse/axe, CI/CD prod, `README.md`, `docs/env.md`, `docs/deploy.md`, `docs/runbook.md` | `qa-engineer`, `security-reviewer`, `docs-writer`, `platform-engineer` |

**Total:** la suma de rangos da **36–46 días-dev**. El objetivo de calendario **~34–43** asume solapamiento parcial (F3 con F4; F6 con F5 y el arranque de F7) y un solo dev. Con dos devs en paralelo desde F3, el calendario baja pero las dependencias de F0/F1/F2 no se pueden solapar.

Hitos de control: al cerrar F1 (esqueleto desplegado en dev), al cerrar F2 (auth real end-to-end), al cerrar F4 (primera tienda pública con temas) y al cerrar F6 (console operable). F7 no empieza hasta que F3–F6 estén verdes.

---

## 17. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| 1 | El custom domain de R2 (`bucket`) queda interceptado por el wildcard de `web` | Imágenes rotas o servidas por el worker equivocado | **Gate F0 abierto**: `*.tucatalogo.live` puede casar con `bucket.tucatalogo.live`. Se revalida con `curl`; si intercepta, se añade una ruta de negación `bucket.tucatalogo.live/*` sin script |
| 2 | Dos instancias Better Auth con cookies host-only y relay a través del worker | Sesiones que no persisten o se cruzan | Spike F0 con prueba de login/logout en ambos reinos; prefijos y secretos separados; tests de aislamiento |
| 3 | 2FA TOTP en Workers (cripto y generación de secreto) | Bloquea el console | Spike F0 contra Web Crypto; backup codes; test de recuperación |
| 4 | React Router v8 framework mode no estable o con fricción en Workers | Reescritura de frontend | Verificar versión estable en F0 antes de fijar dependencias; ADR con la conclusión |
| 5 | Scope creep del console | Retrasa F5/F7 | Alcance cerrado en §11.1; lo demás al backlog |
| 6 | Lighthouse ≥ 90 con imágenes de hero grandes | No cumple el criterio 11 | Normalización a WebP, `srcset`, dimensiones explícitas, lazy salvo primer slide, fuentes subset |
| 7 | Entregabilidad de Resend (OTP en spam) | Registro bloqueado | Dominio verificado con SPF/DKIM/DMARC, plantillas simples, reenvío y límites; driver de prueba en F0 |
| 8 | Workers Paid asumido | Sin el plan de pago, los límites de CPU y R2 no cubren el diseño | Confirmar plan y presupuesto antes de F1 |
| 9 | `/init` expuesto | Toma de control del console | **Cloudflare Access** en el path `init` (activada y verificada **antes** del deploy), one-time (410 tras el primer admin), rate limit por IP y `audit_log` de intentos. Riesgo residual: si Access se desactiva por error, `/init` queda abierto hasta que exista un admin; después el 410 cierra el vector (ADR 0002) |
| 10 | Migraciones destructivas en prod | Pérdida de datos | Expand/contract, revisión obligatoria, Time Travel como red de seguridad |
| 11 | Normalización de imágenes en móviles de gama baja | Fallos de memoria o imágenes rechazadas | Límite 2 MB, canvas con liberación, mensajes claros, tests en dispositivo real |
| 12 | Precedencia de rutas de Cloudflare mal entendida | Hosts cruzados | Verificación empírica en F0 y smoke que comprueba cada host después de cada deploy |
| 13 | Borrado de tienda parcial (R2 ok, D1 falla o al revés) | Datos huérfanos | Orden R2 → D1 con aborto temprano; script de reconciliación en el runbook |

---

## 18. Prerrequisitos

Antes de F1:

1. Zona `tucatalogo.live` activa en Cloudflare (el dominio anterior queda fuera del proyecto).
2. Registro wildcard `*` **proxied** en `tucatalogo.live` y capacidad de crear rutas de Worker por host.
3. Plan **Workers Paid** activo (necesario para el volumen de CPU y los límites de R2 del proyecto).
4. Token de API de Cloudflare con permisos de Workers (scripts y rutas), D1 y R2, más lectura de zona. Guardado como repository secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
5. Resend con el dominio de envío verificado (SPF/DKIM) y una API key.
6. Turnstile: site key (pública, en `apps/commercial/wrangler.jsonc`) y secret key (secreto del api) creadas para los hosts del registro.
7. Repositorio en GitHub con los repository secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, y un GitHub Environment `prod` (sin reglas de protección ni aprobaciones) con los 4 runtime secrets del api como *Environment secrets* (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) y las variables `TURNSTILE_SITE_KEY` y `SMOKE_STORE_HOST`. Deploy prod-only; los runtime secrets se aplican con el workflow manual `sync-secrets`. El `INIT_TOKEN` ya no es un secreto.
8. **Cloudflare Access** activo para el alta: aplicación self-hosted en `console.tucatalogo.live` con path `init`, política que solo admite el email del owner, verificada con `curl -sI https://console.tucatalogo.live/init` (302 a `cloudflareaccess.com`). Es requisito **previo** al deploy del console sin token; sin Access, `/init` queda abierto.
9. **`bucket.tucatalogo.live`**: custom domain de R2 **creado y sirviendo** (`404 text/plain` de R2, TLS OK). El gate de F0 queda **resuelto por diseño** porque el wildcard de `web` vive en la subzona `*.tucatalogo.live` y no puede casar con el host del bucket en el dominio padre. Falta revalidar con `curl` cuando la subzona tenga DNS.
10. Cuentas de correo de prueba y un buzón accesible para E2E de OTP y reset.

---

## 19. Backlog Fase 2

Stripe y tiers con límites por plan · Workers Rate Limiting binding como primera capa del rate limit · variantes de producto (talla, color, tono) · Cloudflare Images · dominios propios (Cloudflare for SaaS) · carrito y checkout · roles de equipo · analítica · i18n · impersonación desde console · gestión de admins · "buscar mi tienda" · email de bienvenida · búsqueda full-text · caché en KV · Sentry · OpenAPI/Postman.

Nada de esta lista entra en F0–F7.

---

## 20. Supuestos derivados, decisiones técnicas y puntos a confirmar

Detalles necesarios para ejecutar y decisiones técnicas de cierre. Los supuestos se confirman en F0; las filas marcadas como decididas ya están cerradas.

| # | Supuesto | Motivo |
| --- | --- | --- |
| 1 | Thumb y full se derivan de `r2_key` con sufijos `-full.webp` / `-thumb.webp` | Las decisiones nombran `r2_key` sin columna de thumb |
| 2 | El payload del paso 1 (incluida la contraseña) se reenvía en el POST final | `signup_intent` no puede guardar la contraseña; el OTP tampoco crea sesión |
| 3 | `product.category_id` usa `on delete set null` | Borrar una categoría no debe borrar productos |
| 4 | `status = 'pending'` se conserva en el enum pero ningún flujo lo produce | Lo fija la decisión del enum; el registro ya no crea tiendas pendientes |
| 5 | **Decidido:** rate limit autoritativo en **D1** (`rate_limit_counter`, ventana fija con UPSERT atómico y sujeto hasheado). **Workers Rate Limiting binding queda post-MVP**; sin Durable Objects | Es la única capa implementada y no requiere recursos extra |
| 6 | Rutas del storefront y del console | Resuelto: implementadas y listadas en §4.3 y `README.md` |
| 7 | **Confirmado en código** (`SESSION_POLICY`): tienda 7 días con renovación diaria; console 8 h fijas | Ya no es un supuesto |
| 8 | `MEDIA_BASE_URL` en dev: un único valor explícito por entorno — el host público del bucket de dev **o** la ruta `/media` del worker dev; nunca los dos | Un solo host por entorno, sin fallback a `cdn.` ni a un segundo host |
| 9 | `?siteId` se acepta **solo en dev/local**, tanto en el storefront como en `/panel-admin`: el **frontend** lo resuelve a un slug y lo envía al API en la cabecera `x-store-slug`; el API nunca lee `?siteId`. En `/panel-admin` la sesión debe pertenecer al dueño de esa tienda; en prod se rechaza con 400 + log. Sigue sin ser un `storeId` de confianza | P4 prohíbe que el `storeId` venga del cliente; el parámetro se acota a dev y no otorga permisos |
| 10 | Migración/limpieza de `signup_intent` expirados por script | No hay tienda pendiente que purgar a 24 h |
| 11 | **Decidido:** `MEDIA_BASE_URL` es la única variable de media. Prod `https://bucket.tucatalogo.live`; local `http://127.0.0.1:9797/media` (ruta dev-only del api); dev un único valor por entorno. Si falta o está mal formada → 503 + log | Cierra el hueco anterior de serving local; un solo host, sin fallback |

### 20.1 Discrepancias detectadas al escribir este plan

- **Total de días:** la suma de fases da 36–46; el objetivo indicado es ~34–43. Se documenta el cálculo real y el supuesto de solapamiento (§16).
- **`status = 'pending'`:** el enum lo incluye, pero la decisión de registro elimina cualquier flujo que lo produzca. Se conserva el enum y se documenta que el MVP crea `active` (§6.5).
- **`?siteId`:** la decisión de dev lo mantiene, mientras P4 prohíbe que el `storeId` venga del cliente. Se acota a dev/local (storefront y `/panel-admin`, con sesión del dueño) y no otorga permisos (fila 9 de §20).
- **`apps/panel` y agentes:** resuelto. Los 12 ficheros de `.opencode/agents/` se reescribieron contra `PLAN.md` v1.1 (sin `apps/panel`, sin `isActive` en store, sin 5 MB, sin tienda `pending`) y declaran a `PLAN.md` como fuente de verdad. No quedan referencias a la arquitectura vieja.
- **`README.md` raíz:** el actual es una guía de subagentes, no el README del proyecto. El README real es entregable de F7; no se sobrescribe aquí.
- **`Requerimientos` v1.0** mantiene `apps/panel`, `isActive`, tienda `pending` y 5 MB: se conserva como baseline con la nota de vigencia, sin reescribir.


