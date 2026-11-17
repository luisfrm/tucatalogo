import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Limpieza local de contadores de rate limit (solo `wrangler dev` + D1 local).
 *
 * Los E2E hacen login/registro varias veces en pocos minutos y los límites del
 * MVP (5 logins / 15 min por IP+email, 5 altas / hora por IP) son intencionados
 * y no se tocan. Este script borra **solo** los contadores locales para poder
 * repetir la suite; no toca tiendas, usuarios ni productos.
 *
 * Uso: node e2e/scripts/reset-local-limits.mjs
 */
const stateDir = "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const databases = fs
  .readdirSync(stateDir)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite");

for (const file of databases) {
  const db = new DatabaseSync(path.join(stateDir, file));
  const tables = db
    .prepare("select name from sqlite_master where type='table'")
    .all()
    .map((row) => row.name);
  if (!tables.includes("rate_limit_counter")) {
    console.log(`${file}: sin rate_limit_counter`);
    continue;
  }
  const before = db.prepare("select count(*) as n from rate_limit_counter").get().n;
  db.exec("delete from rate_limit_counter");
  console.log(`${file}: contadores borrados (${before})`);
}
