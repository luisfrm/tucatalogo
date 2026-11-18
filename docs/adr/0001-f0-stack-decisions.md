# ADR 0001 — Stack y runtime local (F0/F1)

- **Fecha:** 2026-11-17
- **Estado:** aceptado
- **Contexto:** arranque del monorepo F1 sobre las decisiones de `PLAN.md` v1.1.

## Decisiones

1. **React Router v8 (framework mode), no v7.**
   `react-router@8.5.1` es la versión estable publicada (`latest` en npm) y el
   plugin oficial de Cloudflare documenta soporte para v8. Requisitos del
   framework: Node 22.22+, React 19.2.7+ y Vite 7+. Se usa
   `@react-router/dev@8.5.1` con `ssr: true`.
2. **Cloudflare Vite plugin 1.69.1 sobre Vite 8.3.8.**
   El template oficial de `create-cloudflare` para React Router v8 usa
   `cloudflare({ viteEnvironment: { name: "ssr" } })` + `reactRouter()` y
   Vite 8. El bundle del worker lo produce el plugin; no se usa
   `cloudflareDevProxy` (eliminado en v8).
3. **API local en el puerto 9797.**
   Fijado por `PLAN.md` §13.1. `wrangler dev --ip 127.0.0.1 --port 9797` y
   `API_INTERNAL_URL=http://127.0.0.1:9797`. `MEDIA_BASE_URL` local es
   `http://127.0.0.1:9797/media`, con barra final solo en la ruta.
4. **Sin credenciales de Cloudflare.**
   `wrangler.jsonc` define top-level local y `env.dev`/`env.prod` con
   placeholders explícitos (`REPLACE_ME_*`). Ningún ID real se versiona y no se
   ejecuta deploy ni migración remota.
5. **Secretos por app, según `PLAN.md` §13.5.**
   `BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `INIT_TOKEN` y
   `TURNSTILE_SECRET_KEY` viven **solo** en `apps/api/.dev.vars` en local. Los
   frontends reciben únicamente variables públicas. Esto prevalece sobre la
   lectura literal de "todas las variables en cada app".
6. **pnpm 10.34.9 y Node 22.**
   `packageManager` fija pnpm 10; `engines.node` exige `>=22.22.0 <25`. El
   entorno local verificado corre Node 24.15.0, compatible con el rango.
7. **Testing de Workers con `@cloudflare/vitest-plugin` 1.8.3.**
   `@cloudflare/vitest-pool-workers` está deprecado por el propio publisher
   ("renamed to @cloudflare/vitest-plugin"). Se usa el sucesor con Vitest 4.1:
   `cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })` en
   `apps/api/vitest.config.ts`. Cumple el mismo objetivo (tests dentro del
   runtime de Workers con D1/R2 locales) y recibe mantenimiento.

## Consecuencias

- `packages/api-client` importa **solo tipos** de `@tucatalogo/api/app-type`
  (`hc<AppType>`); no arrastra runtime del worker.
- `wrangler types` genera `worker-configuration.d.ts` en cada frontend y se
  ejecuta dentro de `pnpm typecheck` (archivo gitignored).
- El `build` de `apps/api` es `tsc --noEmit`: el artefacto real lo genera
  Wrangler en el deploy. No se ejecuta `wrangler deploy --dry-run` en local
  porque la política del proyecto prohíbe `wrangler deploy*`.
- `packages/themes` solo implementa el tema Rosé en F1. `getTheme` lanza para
  IDs no implementados: no hay tema por defecto (P1/P7).

## Pendiente

- Gate F0 de hosts: **resuelto por diseño**. El wildcard vive solo en la subzona
  (`*.tucatalogo.live`) y el bucket en el dominio padre
  (`bucket.tucatalogo.live`), así que no pueden casar. La comprobación
  con `curl` se mantiene como test de regresión.
- Sustituir placeholders de D1/R2 y hosts de `env.dev` al crear los recursos.
