# Autenticación (F2)

Dos instancias de **better-auth 1.7.25** sobre D1 (Drizzle), una por reino.
Ninguna de las dos monta el handler HTTP de la librería: el API expone rutas
propias (`/auth/store/*`, `/auth/console/*`) que validan Zod, aplican rate
limits y llaman a `auth.api.*` en servidor.

## Contrato para los frontends (service binding)

1. El worker que atiende el host público reenvía la petición al API con:
   - `cookie`: **la cookie del navegador tal cual** (`request.headers.get("cookie")`).
   - `x-store-slug`: slug resuelto del `Host` (o del `?siteId` de dev) **en el
     servidor**. Sobrescribe siempre cualquier valor que venga del navegador.
   - `x-client-ip`: IP real del cliente, si la conoces (`cf-connecting-ip`).
     Solo se usa para rate limiting y se guarda hasheada.
2. Copia **todas** las `set-cookie` de la respuesta del API a la respuesta del
   navegador, sin reescribir el host ni el `Domain`:

   ```ts
   const apiResponse = await api(request); // service binding
   const response = new Response(apiResponse.body, apiResponse);
   for (const cookie of apiResponse.headers.getSetCookie()) {
     response.headers.append("set-cookie", cookie);
   }
   return response;
   ```

3. El navegador nunca ve un token: las respuestas de auth no incluyen
   `token`, y las cookies son `HttpOnly`.

### Cabeceras internas

| Cabecera | Uso | Obligatoria |
| --- | --- | --- |
| `x-store-slug` | Reino tienda: login, session. Nunca se lee del body. | Sí en `/auth/store/login` y `/auth/store/session` |
| `x-client-ip` | Rate limits y `session.ip_address`. | No |

`storeId` sale **siempre** de la sesión + tienda resuelta en servidor; nunca de
`body`, `query` arbitraria ni cabecera del navegador.

> **B1:** el API ya **no** acepta `?siteId` para resolver la tienda. La única
> fuente es `x-store-slug`, que fija el worker que atiende el host. En local,
> ese worker debe resolver el `?siteId` que use el frontend a un slug antes de
> llamar al API (o, más simple, mandar el slug directamente). Cualquier
> `?siteId` en una petición de auth se ignora y la respuesta es 400
> `STORE_SLUG_MISSING` si falta la cabecera.

### Cookies

| Reino | Nombre en local | Nombre en dev/prod | Atributos |
| --- | --- | --- | --- |
| tienda | `store.session_token` | `__Secure-store.session_token` | `HttpOnly; SameSite=Lax; Path=/`, `Secure` fuera de local, **sin `Domain`** |
| console | `console.session_token` | `__Secure-console.session_token` | idem |
| challenge 2FA | `console.two_factor` | `__Secure-console.two_factor` | 10 min |

Reenvía las cookies por nombre-que-llegue (`getSetCookie()`), nunca
hardcodees el prefijo `__Secure-`: depende del entorno.

### Console: cuándo sale la cookie de sesión (M1)

La cookie de sesión de console **solo** la emite `POST /auth/console/2fa/verify`.

| Petición | Cookies que devuelve | Cuerpo |
| --- | --- | --- |
| `POST /auth/console/init` | **ninguna** | `{ admin, totpUri, backupCodes, enrollmentRequired, enrollmentToken }` |
| `POST /auth/console/2fa/setup` | **ninguna** | `{ totpUri, backupCodes, enrollmentToken }` |
| `POST /auth/console/login` (2FA pendiente) | **ninguna** | `{ admin, twoFactorRequired: true, enrollmentRequired: true, enrollmentToken }` |
| `POST /auth/console/login` (2FA ya verificado) | `console.two_factor` | `{ admin: null, twoFactorRequired: true }` |
| `POST /auth/console/2fa/verify` | `console.session_token` | 204 |

`enrollmentToken` es un challenge propio (32 bytes, hash en
`admin_verifications`, 10 min, un solo uso) que se envía en el **body** de
`/2fa/verify` junto al `code`. No es una sesión: usarlo como cookie devuelve
401. `/2fa/setup` requiere `{ email, password }` porque ya no hay sesión de la
que colgar el enrolamiento.

`GET /console/*` exige además `admin_two_factor.verified = 1`: una sesión con
`twoFactorEnabled` a 1 pero la fila de 2FA sin verificar responde 403
`TWO_FACTOR_REQUIRED`.


## Outbox de email de desarrollo (local)

Con `ENVIRONMENT=local` **y** `EMAIL_DRIVER=memory`, el driver `memory` guarda el
último correo por destinatario en un ring buffer **en memoria del isolate**
(nunca en logs ni en D1) y lo expone para navegador/E2E:

```bash
# OTP del registro (o el último correo de ese email)
curl "http://127.0.0.1:9797/dev/outbox?to=duena@example.com"
# último correo emitido, sin conocer el destinatario (flujo de console)
curl "http://127.0.0.1:9797/dev/outbox/last"
```

Respuesta (`Cache-Control: no-store`):

```json
{
  "to": "duena@example.com",
  "kind": "otp",
  "subject": "Tu código de verificación · TuCatálogo",
  "text": "…código 123456…",
  "html": "<!doctype html>…",
  "createdAt": "2026-11-17T08:12:03.114Z",
  "code": "123456"
}
```

Para `kind: "reset"` viene `resetUrl` (enlace absoluto) en vez de `code`.
404 si no hay correo para ese destinatario o el outbox está vacío; 400 sin `to`.
Fuera de `local` (dev/prod) o con otro driver, la ruta responde **404**: no hay
bypass por cabecera ni por query, y no forma parte de `AppType`.

`EMAIL_DRIVER=console` sigue disponible como alternativa: imprime el OTP y el
enlace en el log de `wrangler dev`.

## Rutas

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/auth/store/slug-check?slug=` | 200 `{ slug, available, reason, links }` |
| POST | `/auth/store/signup/otp` | 202 `{ ok, resendAfterSeconds, expiresInMinutes }` |
| POST | `/auth/store/signup` | 201 `{ user, store, links }` |
| POST | `/auth/store/login` | 200 `{ user, store, expiresAt }` + cookie |
| GET | `/auth/store/session` | 200 `{ user, store, expiresAt }` |
| POST | `/auth/store/logout` | 204 + cookies de borrado |
| POST | `/auth/store/password/forgot` | 202 `{ ok: true }` (siempre) |
| POST | `/auth/store/password/reset` | 204 |
| GET | `/auth/console/init-status` | 200 `{ available }` |
| POST | `/auth/console/init` | 201 `{ admin, backupCodes, totpUri, enrollmentRequired: true, enrollmentToken }` (sin cookies) |
| POST | `/auth/console/login` | 200 `{ admin, twoFactorRequired, enrollmentRequired, enrollmentToken? }` |
| GET | `/auth/console/session` | 200 `{ admin, expiresAt }` (exige 2FA verificado) |
| POST | `/auth/console/logout` | 204 |
| POST | `/auth/console/2fa/setup` | 200 `{ totpUri, backupCodes, enrollmentToken }` (sin cookies) |
| POST | `/auth/console/2fa/verify` | 204 + cookie de sesión |
| POST | `/auth/console/password/forgot` | 202 `{ ok: true }` |
| POST | `/auth/console/password/reset` | 204 |

Errores: envelope `{ error: { code, message, reason?, details?, requestId } }`.
`reason` es el sub-código estable; catálogo en `src/constants/auth.ts`
(`AUTH_REASONS`). `429` siempre lleva `Retry-After`.

## Middlewares para el panel y el console

```ts
import { requireAdminSession, requireStoreSession } from "./middleware/session";

panel.use("*", requireStoreSession); // deja c.get("storeId") / storeSlug / store / storeOwner
console.use("*", requireAdminSession); // deja c.get("adminId") / adminUser (2FA completado)
```

`storeId` sale **siempre** de la sesión + tienda resuelta en servidor; nunca de
`body`, `query` arbitraria ni cabecera del navegador.

## Variables

| Variable | Dónde | Notas |
| --- | --- | --- |
| `BETTER_AUTH_SECRET_STORE` / `_CONSOLE` | secreto | 32+ bytes; falta → 503 |
| `INIT_TOKEN` | secreto | solo `/auth/console/init`, comparación en tiempo constante |
| `RESEND_API_KEY` | secreto | obligatorio con `EMAIL_DRIVER=resend` |
| `TURNSTILE_SECRET_KEY` | secreto | obligatorio con `TURNSTILE_MODE=enabled` |
| `EMAIL_DRIVER` | var | `memory` (local + outbox) \| `console` (solo local) \| `resend` |
| `EMAIL_FROM` / `RESEND_FROM` | var | remitente; `RESEND_FROM` tiene prioridad |
| `TURNSTILE_MODE` | var | `test` \| `enabled` \| `disabled` (solo local) |
| `STORE_ORIGIN_TEMPLATE` | var | `https://{slug}.luisrivas.site` |
| `CONSOLE_ORIGIN` | var | `https://console-tucatalogo.luisrivas.site` |

Sin fallback: cualquier variable ausente o modo desconocido responde `503` con
log de error (nunca un valor por defecto).
