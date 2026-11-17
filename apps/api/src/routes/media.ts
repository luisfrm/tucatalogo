/**
 * `GET /media/*` — **solo local/development** (PLAN §8.2 / §8.5).
 *
 * Sirve objetos de R2 bajo `stores/` para que en local
 * `MEDIA_BASE_URL=http://127.0.0.1:9797/media`. En prod esta ruta no existe:
 * responde 404 y nunca toca R2. Cualquier path fuera de `stores/` o con
 * traversal es 404.
 */
import { Hono } from "hono";

import { MEDIA_CACHE_CONTROL } from "../constants/catalog";
import { AppError } from "../errors";
import { isSafeMediaKey } from "../libs/media";
import { readMediaObject } from "../services/media";
import type { AppEnv } from "../types";

const NOT_FOUND_MESSAGE = "Recurso no encontrado.";

export function mediaEnabled(environment: string | undefined): boolean {
  return environment === "local" || environment === "development";
}

function extractKey(path: string): string | null {
  const prefix = "/media/";
  if (!path.startsWith(prefix)) return null;
  const raw = path.slice(prefix.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export const mediaRoutes = new Hono<AppEnv>().get("/*", async (c) => {
  if (!mediaEnabled(c.env.ENVIRONMENT)) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }

  const key = extractKey(c.req.path);
  if (!key || !isSafeMediaKey(key)) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }

  const object = await readMediaObject(c.env, key);
  if (!object) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }

  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "cache-control": MEDIA_CACHE_CONTROL,
  });
  if (typeof object.size === "number") {
    headers.set("content-length", String(object.size));
  }

  return new Response(object.body, { headers });
});
