import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * @cloudflare/vitest-pool-workers fue renombrado a @cloudflare/vitest-plugin
 * (ver docs/adr/0001-f0-stack-decisions.md). Corre los tests en el runtime de
 * Workers con D1/R2 locales.
 *
 * Los tests no dependen de `.dev.vars` ni de la red: las variables de auth se
 * fijan aquí (`EMAIL_DRIVER=memory`, `TURNSTILE_MODE=test`) y las migraciones
 * se inyectan como binding para aplicarlas en `test/setup.ts`.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations("../../packages/db/migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "local",
            APP_DOMAIN: "localhost",
            MEDIA_BASE_URL: "http://127.0.0.1:9797/media",
            EMAIL_DRIVER: "memory",
            EMAIL_FROM: "TuCatálogo <no-reply@localhost>",
            TURNSTILE_MODE: "test",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
            STORE_ORIGIN_TEMPLATE: "http://{slug}.localhost:5173",
            CONSOLE_ORIGIN: "http://localhost:5175",
            BETTER_AUTH_SECRET_STORE: "test-secret-store-0123456789abcdef0123456789",
            BETTER_AUTH_SECRET_CONSOLE: "test-secret-console-0123456789abcdef0123456789",
            INIT_TOKEN: "test-init-token-0123456789abcdef",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
      // El registro completo encadena scrypt + varias escrituras D1.
      testTimeout: 30_000,
    },
  };
});
