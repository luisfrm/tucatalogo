import { applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

import { clearEmailOutbox } from "../src/libs/email";
import { testEnv } from "./env";

/**
 * Aplica las migraciones versionadas de `packages/db` en la D1 local del test.
 * Se ejecuta una vez por worker de test; `applyD1Migrations` es idempotente
 * (registra lo aplicado en `d1_migrations`).
 */
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);

beforeEach(() => {
  // El buzón de pruebas es estado de módulo: se limpia entre casos.
  clearEmailOutbox();
});
