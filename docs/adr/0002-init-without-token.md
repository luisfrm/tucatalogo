# ADR 0002 — Alta del console sin `INIT_TOKEN` (Cloudflare Access)

- **Fecha:** 2026-11-18
- **Estado:** aceptado
- **Decisión del owner.** Sustituye la parte de `/init` del ADR 0001 y de
  `PLAN.md` §7.4.
- **Contexto:** el alta del primer administrador del console (`/init`) es una
  página pública del host `console.tucatalogo.live`. Hasta esta fecha se protegía
  con `INIT_TOKEN`: un Worker secret del `api` que el formulario del console
  recibía y reenviaba por service binding, comparado en tiempo constante en el
  `api`, con one-time (410 después del primer admin), rate limit por IP y
  `audit_log` (`admin.init`).

## Contexto

`/init` solo debe poder usarse **una vez en la vida** del proyecto: crea el
`admin_users` único del console, obliga a enrolar TOTP y muestra los backup codes
una sola vez. Después responde 410 sin importar quién llame.

El `INIT_TOKEN` cumplía su función, pero tenía coste operativo:

- Hay que generarlo, guardarlo como *Environment secret* de GitHub, sincronizarlo
  al worker con `sync-secrets` y rotarlo a mano. Es un secreto más que puede
  quedar desactualizado entre el Environment de GitHub y el worker.
- Distribuirlo al humano que hace el alta (pegado en un formulario) lo expone a
  portapapeles, historial y capturas.
- La barrera vive **dentro** del sistema que protege: si el `api` se equivoca al
  comparar, la única defensa cae con él.

El owner decidió eliminarlo y delegar el control de acceso a **Cloudflare
Access** delante del path `init`.

## Decisión

1. **El formulario `/init` no pide token.** El console envía solo nombre, email y
   contraseña al `api` por service binding. `INIT_TOKEN` deja de ser un Worker
   secret, de existir en `.dev.vars` y de viajar en el payload.
2. **Cloudflare Access (Zero Trust) protege `console.tucatalogo.live/init`** con
   una aplicación *self-hosted* limitada a ese path y una política que solo admite
   la identidad del owner (email). El resto del console —`/login`, `/2fa`,
   `/recuperar`, `/tiendas`, `/auditoria`— **no** pasa por Access y conserva su
   autenticación propia.
3. En la aplicación se mantienen las defensas que no dependen del edge:
   - `admin_users` vacía como condición; después del primer admin, **410 Gone**.
   - Rate limit propio (`/init`, 5 por hora por IP).
   - `audit_log` (`admin.init`).
   - Sin cookies: `/init` solo devuelve `enrollmentToken`; la sesión nace en
     `/2fa/verify`.
4. Access es un requisito **previo** al deploy de la versión sin token. Sin él,
   `/init` quedaría abierto (ver `docs/deploy.md`).

## Alternativas descartadas

| Alternativa | Por qué se descarta |
| --- | --- |
| **Mantener el token** | Es la opción más barata en código y añade una barrera independiente del edge, pero conserva el coste operativo (generar, distribuir, rotar, sincronizar) y un secreto más que puede divergir entre GitHub y el worker. El owner prioriza reducir secretos y usar identidad del edge |
| **IP allowlist** (regla WAF/Cloudflare sobre el path) | La IP del owner cambia (móvil, CGNAT, viajes) y la lista se queda obsoleta en silencio; no identifica a la persona, no deja un registro de quién entró y un cambio de red deja el alta inaccesible en el peor momento |
| **Ventana temporal** (bandera de deploy o `/init` abierto solo unos minutos) | Exige un deploy o un cron para cerrarla, y si el cierre falla la página queda abierta sin ninguna barrera; no identifica al solicitante ni permite auditar el acceso. Con Access el control es una política, no un temporizador |

## Consecuencias

**A favor**

- Un secreto menos: los runtime secrets del `api` pasan de 5 a 4
  (`BETTER_AUTH_SECRET_STORE`, `BETTER_AUTH_SECRET_CONSOLE`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`). No hay nada que rotar para el alta.
- El acceso queda identificado y registrado en el edge (Access logs) antes de
  tocar la aplicación.
- El one-time (410) sigue cerrando el vector para siempre después del primer
  admin, aunque Access falle más adelante.

**Riesgo asumido**

- **Una sola barrera, y vive fuera del repositorio.** La configuración de Access
  (aplicación, path y política) no está en `wrangler.jsonc` ni en CI: es estado
  del dashboard de Cloudflare. Si se desactiva, se le cambia el path o se rompe
  la política **antes** de crear el admin, `/init` queda expuesto y cualquiera que
  llegue primero puede crear el administrador. Mitigación: comprobación con
  `curl -sI` en el checklist de deploy y en el runbook; después del primer admin
  el 410 hace que el fallo sea inofensivo.
- **Se pierde la barrera independiente del edge.** Antes, un fallo de
  configuración de Cloudflare no bastaba para abrir el alta: hacía falta además el
  token. Ahora la aplicación confía en que Access está delante.
- **Rollback con matiz.** Volver a una versión anterior del console/`api` que
  todavía pide token exige recrear `INIT_TOKEN` (`wrangler secret put`) y su
  Environment secret; si el secreto se borró, el rollback de código no restaura el
  flujo antiguo por sí solo.
- **Dev y local no tienen Access.** En local (`http://localhost:5175/init`) la
  página queda abierta en la máquina del desarrollador; la única condición es que
  la D1 local no tenga admin (se reinicia con `node e2e/scripts/reset-admin.mjs`).
  Si algún día se despliega `env.dev`, hay que protegerlo igual o aceptar que el
  alta está abierta en ese host.
- **Dependencia operativa.** Cambiar el email del owner o añadir a otra persona
  implica editar la política de Access (procedimiento en `docs/runbook.md`), no un
  secreto.

**Menciones históricas (no son el estado actual)**

- `INIT_TOKEN` existió como Worker secret del `api` y como *Environment secret*
  (`prod`) hasta este ADR. Ya no se lee ni se genera. Si queda huérfano en el
  worker, se elimina con:

  ```bash
  cd apps/api
  pnpm exec wrangler secret delete INIT_TOKEN --env prod
  ```

  y se borra el *Environment secret* homónimo en GitHub. Ninguno de los dos se
  recrea.

## Referencias

- `PLAN.md` §4.5 F, §7.4, §8.2, §13.5, §15.2 y §17 (riesgo 9).
- `docs/deploy.md` (requisito previo y verificación de Access).
- `docs/runbook.md` (alta del primer admin y recuperación si el alta se consumió).
- `docs/env.md` (inventario de secretos sin `INIT_TOKEN`).
- ADR 0001 (stack y secretos por app).
