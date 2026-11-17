import { defineConfig } from "drizzle-kit";

/**
 * Solo genera SQL versionado. Las migraciones se aplican con
 * `wrangler d1 migrations apply` (local en F1, dev/prod en deploy).
 * Las tablas viven en `schema/` (un fichero por dominio).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./schema/index.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
