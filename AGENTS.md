# TuCatálogo – Contexto del proyecto (MVP / Fase 1)

SaaS multitienda de catálogos (zapatos, maquillaje, sandalias). Una cuenta = una tienda.
Cada tienda vive en `slug.tucatalogo.live` con panel en `/panel-admin` y pedido por WhatsApp.
Plan vigente y detalle de decisiones: **`PLAN.md` (v1.1)**. Los requerimientos v1.0 son baseline.

## Superficies y hosts

| App | Prod | Rol |
| --- | --- | --- |
| `apps/commercial` | `tucatalogo.live` | Landing + registro multipaso |
| `apps/console` | `console.tucatalogo.live` | Backoffice SaaS: tiendas, suspensión, borrado, audit |
| `apps/web` | `*.tucatalogo.live` | Storefront **y** `/panel-admin` (panel del dueño) |
| `apps/api` | sin ruta pública | Hono; solo service binding |

- **No existe `apps/panel`**: el panel del dueño son rutas de `apps/web`.
- **Un solo dominio propio: `tucatalogo.live`.** El **apex es el commercial**;
  `console` y `bucket` (R2) son hosts exactos de la misma zona; `*.tucatalogo.live`
  cubre solo las tiendas y `www` redirige 301 al apex.
- `luisrivas.site` queda **fuera del proyecto**: solo se eliminan sus registros
  `tucatalogo*`; el resto de esa zona no se toca.
- Apex (commercial) y `www` → 301 a `tucatalogo.live` (Redirect Rules). R2: `bucket.tucatalogo.live`, host único.
- Dev: `*-dev.workers.dev` + `?siteId`; sin wildcard.

## Stack

Monorepo **pnpm** · **Cloudflare Workers** (`wrangler.jsonc`, `env.dev` / `env.prod`, local = `wrangler dev`) · **Hono** · **D1 + Drizzle** (migraciones versionadas) · **R2** · **React Router v8 framework mode** · **better-auth** · **Resend** · **Zod** en `packages/types` · **Radix + CVA + Tailwind v4**.

## Estructura

```
apps/api         Hono. ÚNICO con acceso a D1 y R2
apps/commercial  landing + registro
apps/console     backoffice SaaS
apps/web         storefront + /panel-admin
packages/db      esquema Drizzle + migraciones + seeds
packages/types   schemas Zod y tipos
packages/shared  código usado por 2+ apps
packages/api-client  Hono RPC + adapter + funciones de dominio
packages/themes  tokens, fuentes, metadata, motor OKLCH
packages/ui      componentes globales
packages/config  tsconfig, eslint, tailwind
```

## Reglas no negociables

1. commercial, console y web hablan con api **solo por service binding**. La api no tiene ruta pública.
2. El `storeId` sale siempre de la sesión o del slug resuelto en servidor. Nunca de un parámetro del cliente. `?siteId` solo se acepta en dev/local (storefront y `/panel-admin`) como resolución de host: no es un `storeId` de confianza, en `/panel-admin` la sesión debe ser del dueño de esa tienda, y en prod se rechaza con 400 + log.
3. El navegador **nunca** llama al API: loaders/actions y resource routes same-origin vía `packages/api-client`. Sin TanStack Query.
4. **Dos reinos de auth**: `store_users` (dueños) y `admin_users` (console). Dos instancias Better Auth, secretos separados, cookies **host-only** con prefijo `store` / `console`. Sin `domain=.tucatalogo.live`. El alta del console (`/init`) **no usa token ni secreto**: la protege **Cloudflare Access** (aplicación self-hosted sobre `console.tucatalogo.live/init`), más one-time (410 después del primer admin), rate limit por IP y `audit_log`. Si Access no está activo, `/init` queda abierto: activarlo es requisito **previo** a desplegar (ver `docs/deploy.md` y `docs/adr/0002-init-without-token.md`).
5. Una cuenta = una tienda (`store.owner_id` único). Suspender ≠ eliminar.
6. `store.status` = `pending|active|suspended` + `suspendedBy` (`owner|admin`) + `suspendedReason`. **Sin `isActive`**. El owner solo reactiva si `suspendedBy = owner`; el console reactiva siempre.
7. Registro: **nada se persiste antes del OTP**. `signup_intent` guarda email, hash del OTP, intentos y expiración; nunca la contraseña. Sin tienda `pending` ni purga a 24 h.
8. Eliminar tienda = hard delete (D1 + R2 + `store_users`) + cuarentena de slug 90 días. Suspender = 404 público, `/panel-admin` sigue accesible con banner.
9. API en capas **Route > Service > Repository**. D1/Drizzle solo en repositories; los services no importan Drizzle.
10. Código compartido: 2+ usos en una app → `apps/<app>/src`; 2+ apps → `packages/shared`.
11. Zod en entrada y salida. Entrada inválida = 4xx; fallo grave = 5xx; nunca 500 por validación.
12. **Sin fallbacks silenciosos**: falta de env/config → 500/503 + log. Tema o moneda inválidos → 400 al escribir, 500 + log al leer. Sin placeholders ni hosts alternativos.
13. Imágenes: entrada máx. 2 MB, normalización **en el navegador** a WebP full 1600 px + thumb 600 px, EXIF eliminado. Máx. 8 por producto y 10 slides de hero.
14. Precios en unidad mínima (entero) con la moneda de la tienda: USD, EUR, COP, VES, ARS.
15. Temas: 5 (Rosé default `#C09299`, Nude Studio, Velvet Noir, Sol de Verano, Urban Slate), claro + oscuro, mismo layout y grilla. Injector SSR con CSS vars en `<head>`, sin FOUC; oscuro por cookie. Motor OKLCH que ajusta el color del cliente para AA, sin tema por defecto.
16. UI: Radix + CVA + Tailwind v4, tokens semánticos, contraste WCAG AA, mobile-first, estados de carga/vacío/error en toda pantalla.
17. Interfaz y correos **solo en español**. Código, nombres y commits en inglés.
18. Slugs reservados: `www, api, panel, admin, console, app, mail, static, media, assets, cdn, commercial, tucatalogo, console-tucatalogo, tucatalogo-bucket`.
19. Fuera del MVP: Stripe/tiers, variantes, Cloudflare Images, dominios propios, carrito, roles, analítica, i18n, impersonación, gestión de admins.

## Flujo de trabajo

- `tech-lead` planifica y delega; cada subagente trabaja en su carpeta y no toca áreas ajenas sin avisar.
- Antes de terminar: `pnpm lint`, `pnpm typecheck` y tests del área en verde (scripts definidos en F1).
- Commits pequeños (Conventional Commits). Todo cambio de esquema lleva migración y es compatible hacia atrás.
- Seeds SQL solo en local/dev; prod se despliega solo con esquema. El primer admin se crea con `/init`, no con seed.
- Permisos del console: `/init` está detrás de Cloudflare Access y es one-time (después 410), 2FA TOTP obligatorio, sin UI de gestión de admins.
- Registro con Turnstile y páginas de términos/privacidad; Worker Paid asumido.
- Criterio de parada: 13 criterios del baseline + 4 de console + no-fallback (§15 de `PLAN.md`).
