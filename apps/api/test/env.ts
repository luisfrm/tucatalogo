import { env } from "cloudflare:test";

import type { Env } from "../src/env";

/**
 * `cloudflare:test` tipa `env` con el `Cloudflare.Env` ambiental (vacío en este
 * repo, que no genera `worker-configuration.d.ts`). Este alias le da el tipo
 * real del worker para poder tocar D1 en los tests.
 */
export type TestEnv = Env & {
  DB: D1Database;
  TEST_MIGRATIONS: { name: string; queries: string[] }[];
};

export const testEnv = env as unknown as TestEnv;
