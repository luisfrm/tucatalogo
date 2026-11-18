import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Limpieza local del reino console (`admin_*`) en la D1 de `wrangler dev`.
 *
 * `/init` es one-time: para repetir el alta hay que vaciar el reino admin. El
 * script es explícito y **solo** toca las tablas `admin_*`, nunca `store_*`.
 *
 * Ya **no** hace falta para repetir la suite: si la D1 tiene un admin, el
 * proyecto `console` comprueba el 410 y reutiliza el admin de la pasada anterior
 * (`e2e/.state/console-admin.json`). Solo sirve para el caso en que el admin se
 * creó fuera del E2E y no hay credenciales guardadas, o para estrenar un admin
 * nuevo. Tras vaciarlo, la siguiente pasada crea uno y sobrescribe ese archivo.
 *
 * Uso (con los servidores de desarrollo parados, para no competir por el
 * fichero SQLite):
 *   node e2e/scripts/reset-admin.mjs
 */
const stateDir = "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const databases = fs
  .readdirSync(stateDir)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite");

const ADMIN_TABLES = [
  "admin_two_factor",
  "admin_sessions",
  "admin_accounts",
  "admin_verifications",
  "admin_users",
];

for (const file of databases) {
  const db = new DatabaseSync(path.join(stateDir, file));
  const tables = db
    .prepare("select name from sqlite_master where type='table'")
    .all()
    .map((row) => row.name);
  if (!tables.includes("admin_users")) {
    console.log(`${file}: sin tablas admin_*`);
    continue;
  }
  for (const table of ADMIN_TABLES) {
    if (!tables.includes(table)) continue;
    const before = db.prepare(`select count(*) as n from ${table}`).get().n;
    db.exec(`delete from ${table}`);
    if (before > 0) console.log(`${file}: ${table} borradas ${before} filas`);
  }
}
