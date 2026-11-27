# Requerimientos MVP – Plataforma de Catálogos

> Nota: la versión vigente de decisiones y plan está en `PLAN.md` (v1.1). Este documento se conserva como baseline.

**Versión:** 1.0 · **Fase:** 1 (MVP) · **Dominio inicial:** `tucatalogo.live` (luego `tucatalogo.com`)

## 1. Resumen

Plataforma SaaS multitienda para publicar catálogos de productos (zapatos, maquillaje, sandalias, etc.). Cada tienda tiene un único propietario, un subdominio propio `slug.tucatalogo.live`, un panel de gestión en `/panel-admin` y un botón de pedido por WhatsApp. En el MVP todo es ilimitado y gratuito; las suscripciones (Stripe) y tiers llegan en la Fase 2.

## 2. Decisiones técnicas

| Tema | Decisión |
| --- | --- |
| Backend | Hono sobre Cloudflare Workers |
| Frontend | **React Router (framework mode)** para Panel, Commercial y Web. Verificar la versión estable vigente antes de fijar dependencias |
| Base de datos | Cloudflare D1 + Drizzle ORM, migraciones versionadas |
| Auth | **better-auth** (viable sobre D1): email + contraseña, plugin `email-otp` para verificar correo, restablecimiento de contraseña por email |
| Almacenamiento | R2 para imágenes (Cloudflare Images queda para V2) |
| Email | Resend (OTP y recuperación de contraseña) |
| Monorepo | pnpm workspaces |
| Validación | Zod compartido en `packages/types` |
| Entornos | `local` (wrangler dev), `dev` y `prod` (`wrangler deploy --env dev\|prod`) |

## 3. Arquitectura

### 3.1 Apps y paquetes

- `apps/api` – Hono. Único componente con acceso a D1 y R2.
- `apps/commercial` – Landing y registro en `tucatalogo.live`.
- `apps/panel` – Panel de gestión en `slug.tucatalogo.live/panel-admin/*`.
- `apps/web` – Tienda pública en `slug.tucatalogo.live/*`.
- `packages/db` (esquema y migraciones), `packages/themes` (tokens de los temas), `packages/ui`, `packages/types`, `packages/config`.

### 3.2 Enrutamiento y subdominios

- Un registro DNS wildcard `*` (proxied) y una ruta de Worker `*.tucatalogo.live/*` hacia Web. No se crea nada por tienda al registrarse.
- Ruta más específica `*.tucatalogo.live/panel-admin/*` hacia Panel (Cloudflare prioriza la ruta más específica).
- `tucatalogo.live/*` hacia Commercial.
- Web y Panel leen el header `Host`, extraen el `slug` y lo resuelven a `storeId` vía API.
- En local y dev se admite `?siteId=` como alternativa al subdominio.
- Slugs reservados: `www`, `api`, `panel`, `admin`, `app`, `mail`, `static`, `media`, `assets`, `cdn`, `commercial`, entre otros.

### 3.3 Service bindings

- Commercial, Panel y Web llaman a API mediante service binding. La API no se consume por URL pública entre workers.
- Las cookies de sesión son *host-only* (por subdominio), ya que cada tienda tiene su propio usuario; no se requiere `domain=.tucatalogo.live`.
- Panel enruta `/api/auth/*` hacia API por binding para que la cookie quede en el host de la tienda.

## 4. Modelo de datos (alto nivel)

| Tabla | Campos principales |
| --- | --- |
| `user` / `session` / `account` / `verification` | Tablas de better-auth |
| `store` | id, ownerId (único), slug (único), name, status (`pending`, `active`, `suspended`), isActive, themeId, primaryColor, colorMode default `light`, currency, whatsappNumber, whatsappMessageTemplate, logoUrl, plan default `free`, createdAt |
| `product` | id, storeId, name, description, price, currency heredada de la tienda, categoryId, isActive, isDeleted, sortOrder, timestamps |
| `product_image` | id, productId, url (R2), sortOrder |
| `category` | id, storeId, name, slug |
| `hero_slide` | id, storeId, imageDesktopUrl, imageMobileUrl, title, subtitle, ctaLabel, ctaUrl, sortOrder, isActive |

Notas:

- Todo acceso a datos filtra por `storeId` derivado de la sesión, nunca de un parámetro del cliente.
- `plan` existe desde el inicio para no migrar en la Fase 2, pero sin límites aplicados.
- Los precios se guardan en la unidad mínima (entero) con la moneda de la tienda.

## 5. Requisitos funcionales

### 5.1 Commercial (`tucatalogo.live`)

- **RF-C1** Landing con propuesta de valor, temas de ejemplo y CTA de registro.
- **RF-C2** Registro multipaso con botones Anterior / Siguiente:
  1. Datos del propietario (nombre, correo, contraseña) y de la tienda (nombre, slug, moneda).
  2. Elección de tema con vista previa.
  3. Verificación de correo con OTP de 6 caracteres.
  4. Confirmación con enlaces a la tienda y a `/panel-admin`.
- **RF-C3** Disponibilidad de slug en tiempo real, con validación de formato (minúsculas, números y guiones) y lista de reservados.
- **RF-C4** La tienda se crea en estado `pending` y pasa a `active` solo tras verificar el OTP. Los registros pendientes se purgan a las 24 h.
- **RF-C5** OTP: expira a los 10 min, máximo 5 intentos, reenvío con espera de 60 s y límite por hora.
- **RF-C6** Una cuenta = una tienda: un correo no puede registrar una segunda tienda.

### 5.2 API

- **RF-A1** Auth: registro, OTP, login, logout, sesión, olvidé mi contraseña y restablecimiento.
- **RF-A2** CRUD de productos, categorías, slides del hero y ajustes de la tienda.
- **RF-A3** Endpoints públicos de solo lectura por slug (tienda, hero, productos activos, producto individual).
- **RF-A4** Subida de imágenes a R2: JPG, PNG o WebP, máximo 5 MB, nombres aleatorios por tienda, con cabeceras de caché.
- **RF-A5** Rate limiting en login, OTP y recuperación de contraseña.
- **RF-A6** Eliminación de tienda: borra todos los datos y los objetos de R2 del propietario.
- **RF-A7** Validación Zod en todas las entradas y respuestas de error consistentes.

### 5.3 Panel (`slug.tucatalogo.live/panel-admin`)

- **RF-P1** Login con correo y contraseña; flujo completo de olvidé mi contraseña por correo.
- **RF-P2** Productos: crear, editar, activar/ocultar (`isActive`), eliminar lógico (`isDeleted`), nombre, precio, categoría y varias imágenes con orden (carrusel).
- **RF-P3** Hero: carrusel con múltiples ítems, cada uno con imagen para desktop e imagen para mobile, texto opcional, CTA opcional y reordenamiento.
- **RF-P4** `/panel-admin/settings`:
  - Datos de la tienda y logo.
  - Selección de tema (mínimo 5) con vista previa y color principal definido por el cliente según su paleta.
  - Modo oscuro disponible para los visitantes (claro por defecto).
  - Moneda: USD, EUR, COP, VES, ARS.
  - WhatsApp: número y plantilla del mensaje con variables (`{producto}`, `{precio}`, `{tienda}`).
  - Suspender tienda (`isActive = false`).
  - Eliminar tienda definitivamente: requiere contraseña y escribir el slug como confirmación.
- **RF-P5** Estados de carga, vacíos y error en todas las pantallas.

### 5.4 Web (tienda pública)

- **RF-W1** Resolución de la tienda por subdominio; 404 si no existe, está suspendida o eliminada.
- **RF-W2** Home con carrusel de hero (imagen desktop/mobile según viewport) y grilla de productos.
- **RF-W3** Página de producto con carrusel de imágenes, nombre, precio con formato de la moneda y botón de WhatsApp.
- **RF-W4** Botón de WhatsApp: abre `wa.me/<número>?text=<mensaje codificado>` usando la plantilla de la tienda. Si no hay número configurado, el botón no se muestra.
- **RF-W5** Filtro por categoría y búsqueda básica por nombre.
- **RF-W6** Modo claro por defecto, con alternancia a oscuro y preferencia recordada.
- **RF-W7** SEO: título, metadatos, Open Graph y sitemap por tienda.
- **RF-W8** Solo productos con `isActive = true` e `isDeleted = false`.

## 6. Sistema de temas

- Todos los temas comparten **la misma grilla y estructura de layout**; cambian solo el sistema de diseño: paleta, tipografías, radios, bordes, sombras y estilo de botones y tarjetas.
- Mínimo **5 temas nombrados**, definidos como tokens en `packages/themes`, cada uno con variante clara y oscura. Propuesta inicial:
  1. **Rosé** – base `#c09299`, redondeado y suave (tema por defecto).
  2. **Nude Studio** – neutros cálidos, serif elegante, bordes finos.
  3. **Velvet Noir** – oscuro-glam, acentos dorados, radios pequeños.
  4. **Sol de Verano** – colores vivos, radios grandes, tipografía amigable.
  5. **Urban Slate** – tema masculino, grises y azul pizarra, radios mínimos.
- **Theme injector** en servidor: variables CSS inyectadas en el `<head>` durante el SSR según el tema de la tienda, sin parpadeo; el modo oscuro se resuelve antes del primer pintado.
- El cliente define su color principal; el tema aporta el resto de la paleta, y los tonos derivados se ajustan para mantener contraste WCAG AA en ambos modos.
- La skill `ui-ux-pro-max` no está disponible en esta conversación; los temas se definen con tokens y criterios propios, a menos que se aporte la skill.

## 7. Infraestructura y CI/CD

- `wrangler.jsonc` por app con entornos `dev` y `prod`; bindings de D1, R2 y service bindings por entorno.
- GitHub Actions: instalación con pnpm, lint, typecheck, tests, migraciones D1 y `wrangler deploy --env <entorno>`.
- Despliegue a `dev` en cada merge a la rama principal; a `prod` con tag o aprobación manual.
- Secretos del repositorio: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- Secretos de runtime de cada Worker: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`.
- La zona DNS debe estar en Cloudflare para usar rutas wildcard.

## 8. Requisitos no funcionales

- Mobile-first y responsive.
- Lighthouse móvil ≥ 90 en rendimiento y accesibilidad en la tienda pública.
- Aislamiento estricto entre tiendas, verificado con tests automáticos.
- Todo en español (panel, tienda y correos).
- Sin datos sensibles en logs; contraseñas gestionadas solo por better-auth.
- Escala objetivo: decenas de tiendas; un único D1 es suficiente.

## 9. Fuera de alcance (Fase 2)

Suscripciones y tiers con Stripe, límites por plan, variantes de producto (talla, color, tono), Cloudflare Images, dominios propios (Cloudflare for SaaS), carrito y checkout, múltiples tiendas por cuenta, roles de equipo, analítica, multi-idioma.

## 10. Criterios de aceptación y parada del MVP

El MVP se considera listo cuando se cumplen **todos** estos puntos:

1. Un usuario nuevo se registra en Commercial, valida el OTP y su tienda queda accesible en `slug.tucatalogo.live` en prod, sin intervención manual.
2. Inicia sesión en `/panel-admin`, crea al menos 10 productos con varias imágenes, configura un hero con 2 o más slides (desktop y mobile) y los ve reflejados en la tienda.
3. Recuperación de contraseña funcional de extremo a extremo.
4. Cambia de tema en settings y la tienda refleja fuentes, radios, bordes y colores sin parpadeo, probado con los 5 temas en claro y oscuro y con un color principal personalizado.
5. Cambia la moneda y el botón de WhatsApp genera un enlace correcto con el mensaje configurado.
6. Suspender oculta la tienda (404 público) y eliminar borra datos e imágenes.
7. Test de aislamiento: un usuario A no puede leer ni escribir datos de la tienda B.
8. OTP y login con casos negativos probados: expiración, intentos máximos, reenvíos y rate limiting.
9. CI despliega a `dev` en cada merge y a `prod` con aprobación, aplicando migraciones D1.
10. Los service bindings funcionan en dev y prod, sin llamadas públicas entre workers.
11. Lighthouse móvil ≥ 90 en rendimiento y accesibilidad; contraste AA en los 5 temas.
12. Slug inexistente o reservado responde con 404 o error controlado, nunca 500.
13. README con setup local, variables de entorno y deploy, y un test E2E (Playwright) verde del flujo registro → panel → tienda.

**Regla de parada:** con los 13 puntos aprobados se congela el alcance y todo lo demás pasa al backlog de la Fase 2.

## 11. Supuestos confirmados

- El cliente define su color principal según su paleta; el tema aporta tipografías, radios, bordes y el resto de la paleta.
- Eliminar la tienda es definitivo e irreversible, sin periodo de gracia.
- El propietario suspende o elimina su tienda desde `/panel-admin/settings`; no existe super-admin en el MVP.
- Las imágenes se sirven desde R2 con caché agresiva.
- Los productos no tienen stock; solo `isActive` e `isDeleted`.
- La Fase 1 usa `tucatalogo.live`; el cambio a `tucatalogo.com` es solo de configuración.

## 12. Prerrequisitos antes de implementar

- Zona `tucatalogo.live` activa en Cloudflare (necesaria para las rutas wildcard).
- Cuenta de Resend con el dominio verificado para enviar OTP y recuperación de contraseña.
- `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` cargados como secretos en GitHub.
