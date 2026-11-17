import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Borra tiendas de prueba `e2e-*` que hayan quedado de ejecuciones fallidas.
 *
 * Usa el **camino real** del console (login + 2FA + `DELETE /console/stores/:id`)
 * contra el API local, de modo que el borrado hace lo mismo que la UI: R2 → D1
 * en batch → `store_users` → cuarentena de slug → `audit_log`. No toca
 * `qa-store` ni ninguna tienda cuyo slug no empiece por `e2e-`.
 *
 * Uso: node e2e/scripts/cleanup-stores.mjs [--dry-run]
 */
const API = "http://127.0.0.1:9797";
const dryRun = process.argv.includes("--dry-run");

const state = JSON.parse(fs.readFileSync(path.resolve("e2e/.state/run.json"), "utf8"));
const admin = state.consoleAdmin;
if (!admin) {
  console.error("No hay consoleAdmin en e2e/.state/run.json. Ejecuta antes el proyecto console.");
  process.exit(1);
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of input.replace(/=+$/g, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

const cookies = new Map();

function cookieHeader() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function api(pathname, init = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookies.size > 0 ? { cookie: cookieHeader() } : {}),
      ...(init.headers ?? {}),
    },
  });
  storeCookies(response);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const login = await api("/auth/console/login", {
  method: "POST",
  body: JSON.stringify({ email: admin.email, password: admin.password }),
});
if (login.status !== 200) {
  console.error("Login del console falló:", login.status, login.body);
  process.exit(1);
}

const verify = await api("/auth/console/2fa/verify", {
  method: "POST",
  body: JSON.stringify({ code: totp(admin.totpSecret), type: "totp" }),
});
if (verify.status !== 204) {
  console.error("2FA falló:", verify.status, verify.body);
  process.exit(1);
}

const targets = [];
for (let page = 1; page <= 20; page += 1) {
  const list = await api(`/console/stores?q=e2e-&page=${page}`);
  if (list.status !== 200) {
    console.error("Listado falló:", list.status, list.body);
    process.exit(1);
  }
  const found = list.body.items.filter((item) => item.slug.startsWith("e2e-"));
  targets.push(...found);
  if (!list.body.hasMore || found.length === 0) break;
}

console.log(`${targets.length} tiendas e2e-* a borrar${dryRun ? " (dry-run)" : ""}`);

for (const item of targets) {
  if (dryRun) {
    console.log(`  [dry-run] ${item.slug} (${item.id})`);
    continue;
  }
  const deletion = await api(`/console/stores/${item.id}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmSlug: item.slug }),
  });
  console.log(`  ${deletion.status} ${item.slug}`);
  if (deletion.status !== 204) console.log("   ", deletion.body);
}
