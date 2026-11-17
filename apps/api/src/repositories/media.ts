/**
 * Repositorio de R2 (PLAN §8.5). Único sitio de `apps/api` que habla con el
 * bucket; los services nunca ven la API de R2.
 *
 * Un fallo de R2 es un `STORAGE_ERROR` (502) y se registra: la operación no
 * continúa para no dejar filas de D1 apuntando a objetos inexistentes.
 */
import type { Env } from "../env";
import { AppError } from "../errors";
import { CATALOG_MESSAGES, CATALOG_REASONS } from "../constants/catalog";

export interface MediaObjectMetadata {
  contentType?: string;
  cacheControl?: string;
}

export interface MediaBucketObject {
  body: ReadableStream;
  size?: number;
  httpMetadata?: MediaObjectMetadata;
  customMetadata?: Record<string, string>;
}

export interface MediaBucketListResult {
  objects: { key: string; size?: number }[];
  truncated: boolean;
  cursor?: string;
}

/**
 * Subconjunto de `R2Bucket` que usa el API. Permite inyectar un bucket falso
 * en los tests de fallo sin tocar el binding real.
 */
export interface MediaBucketLike {
  put(
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: MediaObjectMetadata;
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<MediaBucketObject | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<MediaBucketListResult>;
}

/** Binding de R2 obligatorio: si falta → 503 + log, nunca un bucket vacío. */
export function requireMediaBucket(env: Env): MediaBucketLike {
  if (!env.MEDIA_BUCKET) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Falta el binding MEDIA_BUCKET",
        binding: "MEDIA_BUCKET",
      }),
    );
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      CATALOG_MESSAGES.mediaBaseMissing,
      undefined,
      CATALOG_REASONS.mediaBaseMissing,
    );
  }
  return env.MEDIA_BUCKET as unknown as MediaBucketLike;
}

function storageError(operation: string, key: string, error: unknown): AppError {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Fallo de R2",
      operation,
      key,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return new AppError(
    "STORAGE_ERROR",
    CATALOG_MESSAGES.storageError,
    undefined,
    CATALOG_REASONS.storageError,
  );
}

export async function putMediaObject(
  env: Env,
  key: string,
  bytes: Uint8Array,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  const bucket = requireMediaBucket(env);
  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType, cacheControl },
      customMetadata: { immutable: "true" },
    });
  } catch (error) {
    throw storageError("put", key, error);
  }
}

/** Borra un objeto. Un fallo es 502: la operación que lo pidió debe abortar. */
export async function deleteMediaObject(env: Env, key: string): Promise<void> {
  const bucket = requireMediaBucket(env);
  try {
    await bucket.delete(key);
  } catch (error) {
    throw storageError("delete", key, error);
  }
}

/**
 * Borra varios objetos sin abortar (limpieza de restos de una subida fallida o
 * de una imagen reemplazada). Se registra si falla.
 */
export async function deleteMediaObjectsBestEffort(env: Env, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const bucket = requireMediaBucket(env);
  try {
    await bucket.delete([...keys]);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "No se pudieron borrar objetos de R2 (limpieza)",
        keys: keys.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/** Lista completa (paginada internamente) de un prefijo. */
export async function listMediaPrefix(env: Env, prefix: string): Promise<string[]> {
  const bucket = requireMediaBucket(env);
  const keys: string[] = [];
  let cursor: string | undefined;

  try {
    do {
      const page = await bucket.list({ prefix, cursor, limit: 1000 });
      for (const object of page.objects) keys.push(object.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    throw storageError("list", prefix, error);
  }

  return keys;
}

/**
 * Borra todo lo que cuelga de `stores/<storeId>/` (PLAN §4.5 H).
 * Se ejecuta **antes** de tocar D1; si falla, la tienda sigue viva.
 */
export async function deleteMediaPrefix(env: Env, prefix: string): Promise<number> {
  const bucket = requireMediaBucket(env);
  const keys = await listMediaPrefix(env, prefix);

  try {
    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000);
      if (batch.length > 0) await bucket.delete(batch);
    }
  } catch (error) {
    throw storageError("delete-prefix", prefix, error);
  }

  return keys.length;
}

/** Lectura para la ruta dev-only `/media/*`. `null` si el objeto no existe. */
export async function getMediaObject(env: Env, key: string): Promise<MediaBucketObject | null> {
  const bucket = requireMediaBucket(env);
  try {
    return await bucket.get(key);
  } catch (error) {
    throw storageError("get", key, error);
  }
}
