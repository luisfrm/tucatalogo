/**
 * Variables y bindings del worker `api`.
 * Regla P1: si falta una variable obligatoria, /health responde 503 + log.
 * Los secretos NO se declaran con valor por defecto.
 */
export interface Env {
  ENVIRONMENT: string;
  APP_DOMAIN: string;
  /** Host único de media por entorno, sin barra final (PLAN §13.5). */
  MEDIA_BASE_URL: string;

  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;

  /**
   * Driver de email explícito (PLAN §7.6): `console` imprime en local,
   * `resend` envía por Resend, `memory` guarda en el outbox en memoria del
   * isolate (solo `local`; lo expone `GET /dev/outbox`). Sin fallback.
   */
  EMAIL_DRIVER?: "console" | "resend" | "memory";
  /** Remitente de los correos (`RESEND_FROM` manda sobre `EMAIL_FROM`). */
  RESEND_FROM?: string;
  EMAIL_FROM?: string;

  /**
   * Turnstile: `test` (claves de prueba oficiales, sin red), `enabled`
   * (siteverify real, exige `TURNSTILE_SECRET_KEY`) o `disabled` (solo local).
   */
  TURNSTILE_MODE?: "test" | "enabled" | "disabled";
  TURNSTILE_SECRET_KEY?: string;

  /** Origen del storefront; `{slug}` se sustituye por el slug de la tienda. */
  STORE_ORIGIN_TEMPLATE: string;
  /** Origen del console. */
  CONSOLE_ORIGIN: string;

  RESEND_API_KEY?: string;

  BETTER_AUTH_SECRET_STORE?: string;
  BETTER_AUTH_SECRET_CONSOLE?: string;

  /** Solo tests: migraciones D1 inyectadas por `vitest.config.ts`. */
  TEST_MIGRATIONS?: { name: string; queries: string[] }[];
}
