#!/usr/bin/env node
/**
 * Runner de seeds SQL locales/dev (PLAN §13.3).
 *
 * - Aplica en orden alfabético los `*.sql` de `packages/db/seeds`.
 * - Solo local: la invocación de wrangler lleva `--local` fijo. Producción se
 *   despliega únicamente con esquema, y el primer admin del console se crea con
 *   `/init`, nunca con un seed. El seed de dev lo ejecuta el CI en F7 con su
 *   propia D1, no este script.
 * - Idempotente: guarda el checksum SHA-256 de cada archivo aplicado en la tabla
 *   local `_local_seed_history` y, si no cambió, no vuelve a ejecutarlo. Esa
 *   tabla la crea este script (como `d1_migrations` de wrangler): no forma parte
 *   del esquema versionado y no existe en prod.
 * - Sin fallbacks: si un seed cambió después de aplicarse, falla con un mensaje
 *   explícito en vez de reaplicar en silencio (usar `--force` para forzarlo).
 *
 * Uso:
 *   pnpm db:seed:local            # aplica lo pendiente
 *   pnpm db:seed:local -- --force # reaplica todo y actualiza checksums
 *
 * Variables opcionales: `D1_DATABASE` (por defecto `tucatalogo-local`) y
 * `WRANGLER_CONFIG` (por defecto `apps/api/wrangler.jsonc`).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const seedsDir = join(packageDir, "seeds");
const database = process.env.D1_DATABASE ?? "tucatalogo-local";
const wranglerConfig = resolve(
  packageDir,
  process.env.WRANGLER_CONFIG ?? "../../apps/api/wrangler.jsonc",
);
const force = process.argv.includes("--force");

// `node scripts/seed-local.mjs` no hereda el PATH de pnpm: se invoca el CLI de
// wrangler del paquete con el propio node (sin shell, para no romper el SQL con
// espacios ni comillas). Si no existiera, falla wrangler del PATH de forma
// explícita.
const localWranglerBin = join(packageDir, "node_modules", "wrangler", "bin", "wrangler.js");
const hasLocalWrangler = existsSync(localWranglerBin);

const HISTORY_TABLE = "_local_seed_history";

function fail(message) {
  console.error(`[db:seed:local] ${message}`);
  process.exit(1);
}

function runWrangler(args) {
  const cliArgs = [
    "d1",
    "execute",
    database,
    "--local",
    "--config",
    wranglerConfig,
    ...args,
  ];

  const result = spawnSync(
    hasLocalWrangler ? process.execPath : "wrangler",
    hasLocalWrangler ? [localWranglerBin, ...cliArgs] : cliArgs,
    { encoding: "utf8" },
  );

  if (result.error) {
    fail(`No se pudo ejecutar wrangler: ${result.error.message}`);
  }

  return result;
}

function query(sql) {
  const result = runWrangler(["--json", "--command", sql]);

  if (result.status !== 0) {
    fail(`Consulta fallida: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  // wrangler puede emitir logs antes del JSON; se recorta al array de respuestas.
  const start = result.stdout.indexOf("[");
  const end = result.stdout.lastIndexOf("]");
  if (start === -1 || end === -1) {
    fail(`Respuesta de wrangler no reconocida: ${result.stdout.trim()}`);
  }

  const payload = JSON.parse(result.stdout.slice(start, end + 1));
  return payload.at(-1)?.results ?? [];
}

function applyFile(filePath) {
  const result = runWrangler(["--file", filePath]);
  if (result.status !== 0) {
    fail(`Falló ${filePath}: ${result.stderr.trim() || result.stdout.trim()}`);
  }
}

if (!existsSync(wranglerConfig)) {
  fail(`No existe el wrangler.jsonc de la api: ${wranglerConfig}`);
}

const seedFiles = readdirSync(seedsDir)
  .filter((entry) => entry.endsWith(".sql"))
  .sort();

if (seedFiles.length === 0) {
  console.log(
    "[db:seed:local] No hay seeds en packages/db/seeds. Nada que aplicar.",
  );
  process.exit(0);
}

query(
  `CREATE TABLE IF NOT EXISTS "${HISTORY_TABLE}" (` +
    `"file" TEXT PRIMARY KEY NOT NULL, ` +
    `"checksum" TEXT NOT NULL, ` +
    `"applied_at" INTEGER NOT NULL);`,
);

const applied = new Map(
  query(`SELECT "file", "checksum" FROM "${HISTORY_TABLE}";`).map((row) => [
    row.file,
    row.checksum,
  ]),
);

let appliedCount = 0;

for (const file of seedFiles) {
  const filePath = join(seedsDir, file);
  const sql = readFileSync(filePath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const previous = applied.get(file);

  if (previous === checksum && !force) {
    console.log(`[db:seed:local] Sin cambios, se omite ${file}`);
    continue;
  }

  if (previous !== undefined && previous !== checksum && !force) {
    fail(
      `${file} cambió después de aplicarse (checksum distinto). ` +
        "Los seeds son versionados: crea un archivo nuevo con el cambio o " +
        "reaplica el entorno local con --force.",
    );
  }

  console.log(`[db:seed:local] Aplicando ${file}`);

  // Seed + registro de aplicación en un único batch: si algo falla, no queda
  // un seed aplicado sin registrar (ni al revés).
  const batchFile = join(
    tmpdir(),
    `tucatalogo-seed-${process.pid}-${file.replace(/[^\w.-]/g, "_")}`,
  );
  const appliedAt = Date.now();
  const statements = sql.trimEnd().replace(/;+$/, "");
  writeFileSync(
    batchFile,
    `${statements}${statements.length > 0 ? ";" : ""}
INSERT INTO "${HISTORY_TABLE}" ("file", "checksum", "applied_at")
VALUES ('${file.replace(/'/g, "''")}', '${checksum}', ${appliedAt})
ON CONFLICT("file") DO UPDATE
  SET "checksum" = excluded."checksum", "applied_at" = excluded."applied_at";\n`,
    "utf8",
  );

  try {
    applyFile(batchFile);
  } finally {
    rmSync(batchFile, { force: true });
  }

  appliedCount += 1;
}

console.log(
  `[db:seed:local] Listo: ${appliedCount} aplicado(s), ${seedFiles.length - appliedCount} sin cambios.`,
);
