# Runbook de operaciones

Procedimientos manuales para TuCatálogo. Todo comando se ejecuta desde la raíz del
monorepo salvo que se indique `cd`. Los comandos remotos requieren credenciales de
Cloudflare y confirmación del owner; **no** se ejecutan desde local por defecto.

Convenciones:

- `tucatalogo-local` es la D1 de Miniflare; `tucatalogo-dev` y `tucatalogo-prod`
  son las remotas.
- `--local` siempre habla con Miniflare; `--remote` con Cloudflare.
- `REPLACE_ME_*` es un placeholder: no hay IDs ni secretos reales en el repo.

## 0. Inventario rápido

| Recurso | Comando |
| --- | --- |
| D1 local | `cd apps/api && pnpm exec wrangler d1 execute tucatalogo-local --local --command "<SQL>"` |
| D1 dev/prod | `cd apps/api && pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod --command "<SQL>"` |
| Migraciones | `pnpm db:migrate:local` / `wrangler d1 migrations apply <db> --remote --env <env>` |
| Logs en vivo | `cd apps/api && pnpm exec wrangler tail tucatalogo-api-prod --env prod` |
| Outbox local | `curl "http://127.0.0.1:9797/dev/outbox?to=<email>"` |
| Health de frontends | `curl -s https://tucatalogo.luisrivas.site/health` |

## 1. Rotar `INIT_TOKEN`

El token vive **solo** en el worker `api`; el console lo recibe del formulario
`/init` y no lo guarda.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Local usa también **32 bytes = 64 hex**. Valor de trabajo local:
`22f305ec398dd3b1f6e629a4724e59276ee8c5fdf7aec58a6b28c18307d4e4a8`.
dev y prod llevan un valor propio, distinto del local y entre sí; el valor local
**no** se usa como secreto de prod.

1. Actualiza `apps/api/.dev.vars` (`INIT_TOKEN=...`) y reinicia `pnpm dev:api` si
   no recarga solo.
2. Actualiza el secreto remoto por entorno. **En prod** el valor es un GitHub
   Repository secret: actualízalo en *Settings → Secrets and variables → Actions*
   y lanza el workflow manual **Sync worker secrets** (`target: prod`,
   `confirm: sync`). Si tocas solo el worker con `secret put`, el siguiente
   `sync-secrets` volvería al valor del repositorio.

   ```bash
   cd apps/api
   pnpm exec wrangler secret put INIT_TOKEN --env dev
   ```

3. Comprueba que `/init` sigue disponible (no responde 410) en el entorno donde
   aún no hay admin. Una vez consumido, `/init` responde 410 con cualquier token:
   rotar el token no reabre el alta.
4. Registra el cambio en el canal del equipo. No se versiona el valor.

## 2. Rotar el resto de secretos

### Better Auth (`_STORE` / `_CONSOLE`)

Genera 32 bytes hex por secreto, actualiza los Repository secrets
`BETTER_AUTH_SECRET_STORE` / `BETTER_AUTH_SECRET_CONSOLE` y lanza el workflow
manual **Sync worker secrets** (`target: prod`, `confirm: sync`). Equivalente por
CLI, solo si no usas el workflow:

```bash
cd apps/api
pnpm exec wrangler secret put BETTER_AUTH_SECRET_STORE --env prod
pnpm exec wrangler secret put BETTER_AUTH_SECRET_CONSOLE --env prod
```

**Efecto:** se invalidan todas las sesiones emitidas con el secreto anterior. Los
dueños vuelven a iniciar sesión en su tienda; el admin del console debe repetir
contraseña + 2FA. No hay migración de sesiones. Hazlo en ventana de baja actividad
y verifica con un login real.

### Resend

Actualiza el Repository secret `RESEND_API_KEY` y lanza **Sync worker secrets**
(`target: prod`, `confirm: sync`). Equivalente por CLI:

```bash
cd apps/api
pnpm exec wrangler secret put RESEND_API_KEY --env prod
```

Verifica que `EMAIL_DRIVER=resend` y que hay remitente (`RESEND_FROM` o
`EMAIL_FROM`). Sin clave o sin remitente, cualquier envío responde 503 con log.
Prueba con un reset del console (`/recuperar`).

### Turnstile

1. Crea el widget/keys nuevas en Cloudflare.
2. `TURNSTILE_SECRET_KEY`: actualiza el Repository secret y lanza **Sync worker
   secrets** (`target: prod`, `confirm: sync`).
3. `TURNSTILE_SITE_KEY` es pública: va en `env.prod` de
   `apps/commercial/wrangler.jsonc` (hoy `0x4AAAAAAAGF7HGDtrRDDGsww`), no en
   GitHub. Cámbiala ahí y despliega `commercial`.
4. Con `TURNSTILE_MODE=enabled`, un token ausente o inválido devuelve 400
   `TURNSTILE_FAILED`; un fallo de red de `siteverify` devuelve 503 y el registro
   **no** continúa.

## 3. Crear el primer administrador

1. `pnpm dev:console` (o el host de dev/prod) y abre `/init`.
2. Pega el `INIT_TOKEN`, email y contraseña.
3. Guarda la URI TOTP y los códigos de respaldo (se muestran una sola vez).
4. Continúa a `/2fa`, enrola la app y verifica.
5. Comprueba el 410: recarga `/init`; debe estar cerrado.

El API escribe `audit_log` con `admin.init`. No hay UI para crear más admins
(fuera del MVP).

## 4. Reset de la contraseña del admin

Camino soportado:

1. `/recuperar` en el console → email con enlace de un solo uso (30 min).
2. El enlace apunta a `/reset-password?token=…`, que redirige a
   `/restablecer?token=…`.
3. Cambia la contraseña. El 2FA **no** se salta: el siguiente login pide TOTP o
   código de respaldo.

Si el buzón no está disponible:

- El reset solo se puede completar con el enlace; no hay endpoint de reset por
  SQL.
- Como emergencia, se puede forzar el reenrolamiento de TOTP borrando la fila del
  segundo factor y volver a entrar con la contraseña:

  ```bash
  cd apps/api
  pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
    --command "DELETE FROM admin_two_factor WHERE user_id IN (SELECT id FROM admin_users WHERE email = '<email>');"
  pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
    --command "SELECT id, identifier, expires_at FROM admin_verifications;"
  ```

  Revisa la salida y borra solo las verificaciones de ese admin si están
  bloqueando el flujo. Esto no cambia la contraseña: solo obliga a enrolar 2FA de
  nuevo.

## 5. Suspender y reactivar una tienda

Mecanismo normal: **console → `/tiendas/:id`**.

- **Suspender** exige un motivo no vacío. Escribe `status = suspended`,
  `suspended_by = admin`, `suspended_reason` y `suspended_at`, y registra
  `audit_log` (`store.suspend`). Es idempotente: repetir actualiza motivo y audita.
- **Reactivar** siempre está permitido y escribe `store.reactivate`.
- Efecto público: el storefront responde 404 sin revelar el motivo. El panel del
  dueño sigue accesible con banner y, si la suspensión es administrativa, muestra
  el motivo y no ofrece reactivar.
- El dueño solo puede reactivar si `suspended_by = owner`. Si la suspensión es
  administrativa, recibe 403 y debe pedir la reactivación al console.

Lectura de estado:

```bash
cd apps/api
pnpm exec wrangler d1 execute tucatalogo-local --local \
  --command "SELECT id, slug, status, suspended_by, suspended_reason, suspended_at FROM store WHERE slug = 'demo';"
```

Emergencia (sin UI y sin audit): actualiza D1 directamente **solo** si el console
no está disponible, y deja constancia manual en el canal del equipo. Antes, anota
el bookmark de Time Travel (§11). Respeta la invariante `status = 'suspended'` ⇔
`suspended_by IS NOT NULL`:

```bash
cd apps/api
pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
  --command "UPDATE store SET status = 'suspended', suspended_by = 'admin', suspended_reason = '<motivo>', suspended_at = strftime('%s','now') * 1000, updated_at = strftime('%s','now') * 1000 WHERE slug = '<slug>';"
```

Para reactivar a mano, limpia los tres campos y deja `status = 'active'`.

## 6. Eliminar una tienda

**No hay borrado manual soportado.** El borrado es un hard delete con orden
obligatorio: R2 primero (`stores/<storeId>/`), después D1 en un batch (hijos →
`store` → `store_users`), cuarentena del slug 90 días y `audit_log`
(`store.delete`). Si R2 falla, se aborta con 502 y D1 queda intacto. R2 no se
puede restaurar con Time Travel.

Procedimiento:

1. Confirma con el owner: el slug y la cuenta desaparecen, las imágenes también.
2. Console → `/tiendas/:id` → Eliminar; escribe el slug exacto.
3. Verifica:

   ```bash
   cd apps/api
   pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
     --command "SELECT slug, status FROM store WHERE slug = '<slug>';"
   pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
     --command "SELECT slug, reason, reserved_until FROM slug_reservation WHERE slug = '<slug>';"
   ```

   La primera consulta no debe devolver filas; la segunda debe mostrar la
   cuarentena (90 días).

4. Si el borrado falló con 502, no borres nada a mano: el storefront seguirá
   sirviendo la tienda con sus imágenes. Investiga R2, reintenta y, si hace falta,
   restaura D1 con Time Travel.

Reconciliación (PLAN §17, riesgo 13): compara los prefijos `stores/` del bucket con
los `store.id` de D1. El listado de objetos se hace desde el dashboard de R2
(Objects) o con la API S3; este `wrangler` (4.163.0) no tiene `r2 object list`.

## 7. Depurar un 404 de tienda

El 404 del storefront es **idéntico** para tienda inexistente, suspendida,
eliminada o slug inválido: la respuesta no revela el motivo. Diagnóstico:

1. **Host correcto.** `slug.luisrivas.site` (un subdominio directo). El ápice,
   `www`, subdominios anidados y hosts ajenos no son tiendas.
2. **Slug reservado.** Lista canónica en
   `packages/shared/src/constants/reserved-slugs.ts` (`www`, `api`, `panel`,
   `admin`, `console`, `app`, `mail`, `static`, `media`, `assets`, `cdn`,
   `commercial`, `tucatalogo`, `console-tucatalogo`, `tucatalogo-bucket`).
3. **`?siteId` fuera de local/dev.** En producción responde 400
   (`host.site_id_forbidden`), no 404.
4. **Estado en D1.** Solo las tiendas `active` se sirven:

   ```bash
   cd apps/api
   pnpm exec wrangler d1 execute tucatalogo-prod --remote --env prod \
     --command "SELECT s.slug, s.status, s.suspended_by, s.suspended_reason FROM store s WHERE s.slug = '<slug>';"
   ```

5. **Cuarentena.** `SELECT * FROM slug_reservation WHERE slug = '<slug>';` Si
   `reserved_until` está en el futuro, el slug no se puede registrar.
6. **Logs del worker `web`.** Busca `host.store_not_resolved` (incluye `reason`:
   `root`, `invalid`, `reserved`), `host.site_id_forbidden` o `api.store_error`.

   ```bash
   cd apps/web
   pnpm exec wrangler tail tucatalogo-web-prod --env prod
   ```

7. **API.** `GET /public/:slug/store` devuelve 404 para cualquier tienda no
   activa. No hay host público: se comprueba desde los tests o con
   `wrangler dev`.

## 8. Verificar media y R2

1. Local: sube una imagen desde `/panel-admin/productos` o con los tests, y pide
   la key:

   ```bash
   curl -sI "http://127.0.0.1:9797/media/stores/<storeId>/products/<id>/<uuid>-full.webp"
   ```

   Debe ser 200 con `cache-control: public, max-age=31536000, immutable`.
   Cualquier path fuera de `stores/`, con `..`, con `//` o un objeto inexistente
   devuelve 404. En `development` la ruta también existe; en producción no.

2. Prod: las URLs se construyen solo con `MEDIA_BASE_URL`:

   ```bash
   curl -sI "https://tucatalogo-bucket.luisrivas.site/stores/<storeId>/products/<id>/<uuid>-full.webp"
   ```

3. Si la app devuelve `503 MEDIA_BASE_URL_MISSING`: la variable falta o está mal
   formada (barra final, doble barra, sin esquema). Corrige `wrangler.jsonc` y
   despliega; no hay host alternativo.

4. Si la subida devuelve `502 STORAGE_ERROR`: R2 falló o rechazó el objeto y no se
   insertó la fila. Revisa el binding `MEDIA_BUCKET`, el tamaño (≤ 2 MB), que el
   WebP sea real y el ancho (full ≤ 1600 px, thumb ≤ 600 px).

5. Keys esperadas: `stores/<storeId>/products/<productId>/<uuid>-full.webp` y
   `-thumb.webp`; hero `-desktop.webp` / `-mobile.webp`; logo
   `stores/<storeId>/logo/<uuid>.webp`. Son inmutables.

## 9. Rate limits

Se aplican en el route, antes del service. La única capa implementada hoy es D1
(`rate_limit_counter`, ventana fija con UPSERT atómico); exceso → 429 con
`Retry-After`, sin revelar si el email o la tienda existen.

| Operación | Límite |
| --- | --- |
| Login de tienda | 5 / 15 min por IP+email |
| Login de console | 5 / 15 min por IP+email |
| 2FA verify | 5 / 15 min por sesión de challenge |
| OTP request | 3 / hora por email; 10 / hora por IP; 60 s entre envíos |
| OTP verify | 5 intentos por intent |
| Signup completo | 5 / hora por IP |
| Reset request | 3 / hora por email; 10 / hora por IP |
| Reset token (consumo) | 10 / 15 min por IP |
| `/init` | 5 / hora por IP |

Desbloquear un caso concreto (local):

```bash
cd apps/api
pnpm exec wrangler d1 execute tucatalogo-local --local \
  --command "DELETE FROM rate_limit_counter WHERE bucket LIKE 'otpRequestByEmail:%';"
```

Los buckets son `<operación>:<sujeto hasheado>`; no contienen email ni IP en
claro. En prod, borra solo el bucket afectado y documenta el motivo: saltarse el
límite abre la puerta a abuso.

## 10. Outbox local

```bash
curl "http://127.0.0.1:9797/dev/outbox?to=duena@example.com"
curl "http://127.0.0.1:9797/dev/outbox/last"
```

- Requiere `ENVIRONMENT=local` **y** `EMAIL_DRIVER=memory`; en cualquier otro caso
  responde 404.
- Ring buffer de 50 destinatarios en memoria del isolate: se pierde al reiniciar
  el worker.
- Devuelve `code` (OTP) o `resetUrl` (reset). `Cache-Control: no-store`.
- Sin `to` responde 400. No hay bypass por cabecera ni query.

## 11. D1 Time Travel

Antes de una operación destructiva, guarda el bookmark:

```bash
cd apps/api
pnpm exec wrangler d1 time-travel info tucatalogo-prod
```

Restaurar (solo D1; **no** R2):

```bash
cd apps/api
pnpm exec wrangler d1 time-travel restore tucatalogo-prod \
  --timestamp 2026-11-17T08:00:00.000Z
# o con el bookmark anotado:
pnpm exec wrangler d1 time-travel restore tucatalogo-prod --bookmark <bookmark>
```

`--timestamp` y `--bookmark` son excluyentes. Un borrado de tienda no se puede
deshacer por completo: D1 vuelve atrás, los objetos de R2 no.

## 12. Logs y observabilidad

- Los cuatro workers tienen `observability.enabled` y source maps.
- Logs en vivo:

  ```bash
  cd apps/api
  pnpm exec wrangler tail tucatalogo-api-prod --env prod
  ```

  Cambia el nombre por `tucatalogo-web-prod`, `tucatalogo-commercial-prod` o
  `tucatalogo-console-prod`.

- Cada request lleva `requestId`; el envelope de error lo devuelve al navegador y
  el boundary 500 lo muestra.
- Eventos útiles del frontend: `host.store_not_resolved`,
  `host.site_id_forbidden`, `api.transport_error`, `api.store_error`,
  `panel.store_error`.
- Nunca se registran contraseñas, OTP, tokens, cookies, secretos, cuerpos
  completos, email en claro ni IP en claro (solo hash). Si aparece uno, es un
  incidente de seguridad: rota el secreto afectado y revisa el log.

## 13. Incidentes típicos

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `workerd` no arranca o muere al iniciar | Binario nativo sin `postinstall` (pnpm 10 lo bloquea), Node fuera de rango o instalación corrupta | Comprueba Node 22.22–24.x; `pnpm install`; si persiste, `pnpm rebuild workerd` y borra `node_modules`/`.wrangler` del app afectado |
| Registro: "no pudimos enviar el correo" (502) | Resend rechazó el envío (clave, remitente o dominio) | Revisa el log del API (`Resend rechazó el envío` con status), verifica SPF/DKIM y `RESEND_API_KEY`; el intent no se marca como enviado, el usuario puede reintentar |
| Registro: 503 sin más | Falta configuración (`EMAIL_DRIVER`, `RESEND_API_KEY`/remitente, `TURNSTILE_MODE`) | Log del API con el nombre de la variable; corrige `wrangler.jsonc`/secreto; no hay fallback |
| Registro: "no pudimos verificar que no eres un robot" | Token de Turnstile ausente, caducado o rechazado; o `TURNSTILE_SECRET_KEY` mal | 400 es del token (se pide uno nuevo en el paso); 503 es configuración. En local usa `TURNSTILE_MODE=test` |
| Imágenes 404 con la fila en D1 | Wildcard interceptando el custom domain de R2, o `MEDIA_BASE_URL` apuntando a otro host | `curl -I` al host de media; si responde el 404 del storefront, aplica el gate de R2 (§deploy) y no publiques el bucket |
| `/health` 503 en un frontend | Falta `ENVIRONMENT` o `APP_DOMAIN` | Corrige `vars` del entorno y redespliega |
| Tienda 404 tras un deploy | Storefront sirviendo otro worker/host o tienda suspendida | Sigue §7; comprueba rutas y `status` |
| 429 inesperado en pruebas | Contador de rate limit vigente | §9; borra el bucket afectado solo en local o con justificación |
| `/dev/outbox` 404 | `ENVIRONMENT` distinto de `local` o driver distinto de `memory` | Es el comportamiento correcto; usa `EMAIL_DRIVER=console` o el log |
| `/init` 410 | Ya existe un admin | Es one-time; usa `/login`. Para recuperar acceso, §4 |
