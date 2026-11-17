/** Configuración compartida de los E2E (entorno local de `pnpm dev`). */

export const API_URL = "http://127.0.0.1:9797";
export const WEB_PORT = 5173;
export const COMMERCIAL_URL = "http://localhost:5174";
export const CONSOLE_URL = "http://localhost:5175";

/** `INIT_TOKEN` local documentado en README (no es un secreto de prod). */
export const INIT_TOKEN =
  "22f305ec398dd3b1f6e629a4724e59276ee8c5fdf7aec58a6b28c18307d4e4a8";

/** Tienda de referencia que el equipo usa a mano; los E2E no la borran. */
export const QA_STORE = {
  slug: "qa-store",
  email: "qa-store@example.test",
  password: "QaStore2026!",
  name: "QA Store",
  storeName: "Tienda QA",
} as const;

export function storefrontUrl(slug: string): string {
  return `http://${slug}.localhost:${WEB_PORT}`;
}

export function panelUrl(slug: string, path = ""): string {
  const clean = path.replace(/^\//, "");
  return `${storefrontUrl(slug)}/panel-admin${clean ? `/${clean}` : ""}`;
}

/** Identificador único por ejecución: no choca con datos previos ni con `qa-store`. */
export function runId(): string {
  return `${Date.now().toString(36)}`;
}

export function disposableSlug(id: string): string {
  return `e2e-${id}`;
}
