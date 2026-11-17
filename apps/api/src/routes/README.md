# Contrato del API (F2 – negocio)

API interno de Hono sobre Cloudflare Workers. **No tiene ruta pública**: solo se
consume por service binding desde `web`, `commercial` y `console`, a través de
`packages/api-client`.

- `AppType` (en `src/app.ts`) incluye **todas** las rutas: auth de los dos
  reinos, `/panel/*`, `/public/*`, `/console/*` y `/media/*`. Hono RPC lo usa
  como contrato tipado.
- Envelope de error único:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Mensaje en español para el usuario.",
      "reason": "SUBCODIGO_ESTABLE",
      "details": [{ "path": "slug", "message": "No disponible" }],
      "requestId": "uuid"
    }
  }
  ```

  `reason` es opcional; `details` solo en validación. Códigos: `VALIDATION_ERROR`
  (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT`
  (409), `GONE` (410), `RATE_LIMITED` (429, con `Retry-After`), `INTERNAL` (500),
  `STORAGE_ERROR` (502, fallo de R2) y `SERVICE_UNAVAILABLE` (503).

## Cabeceras y cookies (obligatorio)

| Cabecera | Cuándo | Notas |
| --- | --- | --- |
| `cookie` | Siempre que el navegador tenga sesión | Se reenvía **tal cual**. El API emite `Set-Cookie` host-only con prefijo `store` / `console`. |
| `x-store-slug` | Todo `/panel/*` | Slug resuelto del `Host` (o `?siteId` en dev/local) **en el servidor**. El worker debe sobrescribir cualquier valor del navegador. El API nunca acepta `storeId` del body ni del query. |
| `x-client-ip` | Opcional | IP real del cliente para rate limit y `session.ip_address`. Se guarda hasheada. |

Al devolver la respuesta del API al navegador, copiar **todos** los `Set-Cookie`
sin reescribir host ni `Domain`:

```ts
const apiResponse = await api(request);
const response = new Response(apiResponse.body, apiResponse);
for (const cookie of apiResponse.getSetCookie()) response.headers.append("set-cookie", cookie);
return response;
```

`packages/api-client` expone `copyApiSetCookies(from, to)` para eso.

## Media

- `MEDIA_BASE_URL` (sin barra final) es la **única** fuente de URLs:
  `<MEDIA_BASE_URL>/<key>`. Falta o mal formada → 503 `MEDIA_BASE_URL_MISSING`.
- Keys: `stores/<storeId>/...` (productos, hero, logo). Son inmutables y se
  sirven con `Cache-Control: public, max-age=31536000, immutable`.
- Entrada: WebP real (se valida por magic bytes), **≤ 2 MB** por objeto.
  - Logo y full de producto/hero: ancho ≤ 1600 px.
  - Thumb de producto: ancho ≤ 600 px.
  - Topes: 8 imágenes por producto, 10 slides por hero.
- Un fallo de R2 al subir o borrar es `502 STORAGE_ERROR` y **no** se escribe D1.
- `GET /media/*` solo existe en `local`/`development` (sirve keys bajo `stores/`
  para `MEDIA_BASE_URL=http://127.0.0.1:9797/media`). En producción → 404.

---

## Público (`/public/:slug/*`, solo servidor)

`store` suspendida, eliminada o inexistente → **404 idéntico**; no se revela el
motivo. Solo se leen productos `is_active = 1 AND is_deleted = 0`.

| Método | Ruta | Respuesta 200 |
| --- | --- | --- |
| GET | `/public/:slug/store` | `PublicStore` |
| GET | `/public/:slug/hero` | `{ items: PublicHeroSlide[] }` (solo activos, ordenados) |
| GET | `/public/:slug/products?category=<slug>&q=<texto>&page=<n>` | `{ items, page, pageSize: 24, total, hasMore }` |
| GET | `/public/:slug/products/:productSlug` | `PublicProductDetail` |
| GET | `/public/:slug/sitemap` | `{ categories: [{ slug, updatedAt }], products: [{ slug, updatedAt }] }` |

```ts
PublicStore = {
  slug, name, themeId, primaryColor,
  colorModeDefault: "light" | "dark",
  currency: "USD" | "EUR" | "COP" | "VES" | "ARS",
  whatsappNumber: string | null,
  whatsappMessageTemplate: string | null,
  logoUrl: string | null,
  updatedAt: string // ISO
}

PublicHeroSlide = {
  id, title, subtitle, ctaLabel, ctaUrl,
  sortOrder, desktopUrl, mobileUrl
}

PublicProductCard = {
  id, name, slug, priceMinor, currency,
  categorySlug: string | null, sortOrder,
  image: MediaImage | null
}

PublicProductDetail = {
  id, name, slug, description,
  priceMinor, currency,
  category: { id, name, slug } | null,
  sortOrder, images: MediaImage[], whatsappUrl: string | null,
  updatedAt
}

MediaImage = { id, alt, width, height, sortOrder, fullUrl, thumbUrl }
```

Errores propios: `404 CATEGORY_NOT_FOUND` si `?category=` no existe;
`400 VALIDATION_ERROR` si `page` o `q` no son válidos.

---

## Panel del dueño (`/panel/*`)

Sesión del reino **tienda** + `x-store-slug`. El usuario debe ser
`store.owner_id`. Suspender **no** cierra el panel: `GET /panel/store` sigue
devolviendo `status`, `suspendedBy` y `suspendedReason` para el banner.

### Tienda

| Método | Ruta | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | `/panel/store` | — | `PanelStore` |
| PATCH | `/panel/store` | `{ name?, themeId?, primaryColor?, colorModeDefault?, currency?, whatsappNumber?: string\|null, whatsappMessageTemplate?: string\|null }` | `PanelStore` |
| POST | `/panel/store/logo` | multipart `logo` | `201 { logoKey, logoUrl }` |
| POST | `/panel/store/suspend` | `{ reason? }` | `PanelStore` |
| POST | `/panel/store/reactivate` | — | `PanelStore` |
| DELETE | `/panel/store` | `{ password, confirmSlug }` | `204` |

```ts
PanelStore = {
  id, slug, name,
  status: "pending" | "active" | "suspended",
  suspendedBy: "owner" | "admin" | null,
  suspendedReason: string | null,
  suspendedAt: string | null,
  themeId, primaryColor,
  colorModeDefault, currency,
  whatsappNumber, whatsappMessageTemplate,
  logoKey, logoUrl,
  plan,
  owner: { id, email, name },
  createdAt, updatedAt
}
```

Reglas:

- `PATCH` valida tema (400 `THEME_UNAVAILABLE`), color `#RRGGBB` y moneda;
  `whatsappNumber: null` oculta el botón de forma explícita.
- El dueño solo reactiva si `suspendedBy = "owner"`; si es `"admin"` → `403
  STORE_SUSPENDED_BY_ADMIN` (igual al intentar suspender).
- `DELETE` reautentica con Better Auth (`verifyPassword`, sin crear sesión),
  exige el slug exacto (`400 CONFIRM_SLUG_MISMATCH`), borra **R2 primero** y
  después D1 en un batch: hijos → `store` → `store_users` → cuarentena de slug
  90 días → `audit_log`. Si R2 falla → `502` y D1 queda intacto.

### Productos

| Método | Ruta | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | `/panel/products?q=&category=<id>&status=active\|inactive\|all&page=` | — | `{ items, page, pageSize: 20, total, hasMore }` |
| POST | `/panel/products` | `ProductCreate` | `201 PanelProduct` |
| GET | `/panel/products/:id` | — | `PanelProduct` |
| PATCH | `/panel/products/:id` | `ProductUpdate` | `PanelProduct` |
| DELETE | `/panel/products/:id` | — | `204` (lógico, `is_deleted = 1`) |
| PATCH | `/panel/products/:id/status` | `{ isActive }` | `PanelProduct` |
| PATCH | `/panel/products/reorder` | `{ ids: string[] }` | `204` |
| POST | `/panel/products/:id/images` | multipart `full`, `thumb`, `alt`, `width?`, `height?` | `201 MediaImage` |
| PATCH | `/panel/products/:id/images/:imageId` | `{ alt?, sortOrder? }` | `MediaImage` |
| DELETE | `/panel/products/:id/images/:imageId` | — | `204` |
| PATCH | `/panel/products/:id/images/order` | `{ ids: string[] }` | `PanelProduct` |

```ts
ProductCreate = {
  name, slug,
  description?: string | null,
  priceMinor: number,            // entero ≥ 0, unidad mínima
  categoryId?: string | null,
  isActive?: boolean,            // por defecto true
  sortOrder?: number             // por defecto al final
}

ProductUpdate = { name?, slug?, description?, priceMinor?, categoryId?, sortOrder? }
```

- `priceMinor` va en la moneda de la tienda (no se convierte).
- `reorder` y `images/order` exigen el conjunto exacto de ids de la tienda o del
  producto; si no → `400 REORDER_MISMATCH`.
- `width`/`height` del multipart son opcionales y, si llegan, deben coincidir
  con el full real; el servidor guarda las dimensiones leídas del WebP.
- `DELETE product` es lógico: imágenes y objetos R2 se conservan hasta el hard
  delete de la tienda.

### Categorías

| Método | Ruta | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | `/panel/categories` | — | `{ items: PanelCategory[] }` |
| POST | `/panel/categories` | `{ name, slug, sortOrder? }` | `201 PanelCategory` |
| PATCH | `/panel/categories/:id` | `{ name?, slug?, sortOrder? }` | `PanelCategory` |
| DELETE | `/panel/categories/:id` | — | `204` |

`slug` único por tienda (`409 CATEGORY_SLUG_TAKEN`). Borrar deja los productos
con `category_id = NULL` (`PanelCategory.productCount` cuenta productos vivos).

### Hero

| Método | Ruta | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | `/panel/hero` | — | `{ items: PanelHeroSlide[], limit: 10 }` |
| POST | `/panel/hero` | multipart `desktop`, `mobile`, `title?`, `subtitle?`, `ctaLabel?`, `ctaUrl?`, `isActive?`, `sortOrder?` | `201 PanelHeroSlide` |
| PATCH | `/panel/hero/:id` | `{ title?, subtitle?, ctaLabel?, ctaUrl?, isActive?, sortOrder? }` | `PanelHeroSlide` |
| DELETE | `/panel/hero/:id` | — | `204` |
| PATCH | `/panel/hero/reorder` | `{ ids: string[] }` | `{ items, limit }` |
| POST | `/panel/hero/:id/images` | multipart `desktop`, `mobile` | `PanelHeroSlide` |

- Crear exige las dos imágenes en el mismo multipart: `hero_slide` no acepta
  keys vacías y no se admiten placeholders.
- `ctaUrl` solo admite `https://…` o una ruta relativa `/…`. `ctaLabel` y
  `ctaUrl` van juntos o ambos `null` (`400 HERO_CTA_INCOMPLETE`).
- Tope de 10 slides (`400 HERO_LIMIT_REACHED`). Borrar elimina la fila **y** los
  dos objetos de R2.

---

## Console (`/console/*`)

Sesión del reino **admin** con 2FA completado. Una cookie de tienda devuelve
`401`; una sesión admin sin 2FA devuelve `403 TWO_FACTOR_REQUIRED`. Solo
metadatos: no hay endpoints de productos ni imágenes editables.

| Método | Ruta | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | `/console/stores?q=&status=&page=` | — | `{ items, page, pageSize: 20, total, hasMore }` |
| GET | `/console/stores/:id` | — | `ConsoleStoreDetail` |
| POST | `/console/stores/:id/suspend` | `{ reason }` (obligatorio) | `ConsoleStoreDetail` |
| POST | `/console/stores/:id/reactivate` | — | `ConsoleStoreDetail` |
| DELETE | `/console/stores/:id` | `{ confirmSlug }` | `204` |
| GET | `/console/audit?storeId=&action=&page=` | — | `{ items, page, pageSize: 20, total, hasMore }` |

- `q` busca por slug, nombre o email del dueño. `status` filtra por
  `pending|active|suspended`.
- `ConsoleStoreDetail` = datos de lista + `suspendedReason`, `themeId`,
  `primaryColor`, `colorModeDefault`, `currency`, `plan`, `whatsappNumber`,
  `owner`, `productCount`, `categoryCount`, `slideCount`, `imageCount`.
- Suspender exige motivo; es idempotente (actualiza motivo y audita). Reactivar
  siempre está permitido.
- Eliminar exige el slug exacto, reutiliza el hard delete (R2 → D1 en batch →
  cuarentena → audit) y responde `502` si R2 falla, sin tocar D1.
- `audit` es solo lectura y devuelve `metadata` como objeto JSON (o `null`).

---

## Auth

Los contratos de `/auth/store/*` y `/auth/console/*` están documentados en
`apps/api/src/auth/README.md`. `packages/api-client` expone las funciones de
dominio (`loginStore`, `readStoreSession`, `logoutStore`, `initConsole`,
`loginConsole`, `verifyConsoleTwoFactor`, …) que reenvían cookie y
`x-store-slug` y devuelven los `setCookies` para relay.

## Uso desde un loader (ejemplo)

```ts
const api = createApiClient({ API: env.API });

const store = await getPublicStore(api, slug);         // service binding
const hero = await getPublicHero(api, slug);

const session = await readStoreSession(api, {
  storeSlug: slug,
  cookie: request.headers.get("cookie") ?? undefined,
  clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
});
// session.setCookies → copiar a la respuesta del navegador
```
