import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { APP_VERSION, type AppEnv } from "../types";

const REQUIRED_VARS = ["ENVIRONMENT", "APP_DOMAIN", "MEDIA_BASE_URL"] as const;

type CheckResult = "ok" | "error";

function isMediaBaseUrlValid(value: string | undefined): boolean {
  if (!value || value.endsWith("/")) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * GET /health (interno). Valida env, D1 y media (`MEDIA_BASE_URL` + binding R2)
 * según PLAN §8.6. Sin secretos ni detalles internos en la respuesta.
 */
export const healthRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const checks: Record<"env" | "d1" | "media", CheckResult> = {
    env: "ok",
    d1: "ok",
    media: "ok",
  };

  const missing = REQUIRED_VARS.filter((name) => !c.env[name]);
  if (missing.length > 0) {
    checks.env = "error";
    console.error(
      JSON.stringify({
        level: "error",
        requestId: c.get("requestId"),
        message: "Faltan variables obligatorias",
        missing,
      }),
    );
  }

  if (!isMediaBaseUrlValid(c.env.MEDIA_BASE_URL)) {
    checks.media = "error";
    console.error(
      JSON.stringify({
        level: "error",
        requestId: c.get("requestId"),
        message: "MEDIA_BASE_URL ausente o mal formada",
      }),
    );
  }

  if (!c.env.MEDIA_BUCKET) {
    checks.media = "error";
    console.error(
      JSON.stringify({
        level: "error",
        requestId: c.get("requestId"),
        message: "Falta el binding MEDIA_BUCKET",
      }),
    );
  }

  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (row?.ok !== 1) {
      throw new Error("D1 no devolvió el resultado esperado");
    }
  } catch (error) {
    checks.d1 = "error";
    console.error(
      JSON.stringify({
        level: "error",
        requestId: c.get("requestId"),
        message: "D1 no disponible",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const ok = Object.values(checks).every((value) => value === "ok");
  const status: ContentfulStatusCode = ok ? 200 : 503;

  return c.json(
    {
      status: ok ? "ok" : "error",
      checks,
      version: APP_VERSION,
    },
    status,
  );
});
