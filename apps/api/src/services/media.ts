/**
 * Servicio de media (PLAN §8.5). Orquesta R2 a través del repositorio y
 * construye las URLs públicas con la única variable permitida.
 */
import type { Env } from "../env";
import { MEDIA_CACHE_CONTROL, MEDIA_CONTENT_TYPE, storeMediaPrefix } from "../constants/catalog";
import { mediaUrl, requireMediaBaseUrl } from "../libs/media";
import {
  deleteMediaObject,
  deleteMediaObjectsBestEffort,
  deleteMediaPrefix,
  getMediaObject,
  putMediaObject,
  type MediaBucketObject,
} from "../repositories/media";

/** URL pública de una key. Sin `MEDIA_BASE_URL` → 503 (nunca otro host). */
export function toMediaUrl(env: Env, key: string | null): string | null {
  return mediaUrl(requireMediaBaseUrl(env), key);
}

/** Sube un objeto inmutable. Un fallo de R2 es 502 y no se escribe D1. */
export async function storeMediaObject(
  env: Env,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  await putMediaObject(env, key, bytes, MEDIA_CONTENT_TYPE, MEDIA_CACHE_CONTROL);
}

/** Borra un objeto; si R2 falla, la operación que lo pidió debe abortar. */
export async function removeMediaObject(env: Env, key: string): Promise<void> {
  await deleteMediaObject(env, key);
}

/** Limpieza de restos: no aborta la petición, pero deja rastro en el log. */
export async function removeMediaObjects(env: Env, keys: readonly string[]): Promise<void> {
  await deleteMediaObjectsBestEffort(env, keys);
}

/** Borra todo `stores/<storeId>/`. Es el primer paso del hard delete. */
export async function removeStoreMedia(env: Env, storeId: string): Promise<number> {
  return deleteMediaPrefix(env, storeMediaPrefix(storeId));
}

/** Lectura para la ruta dev-only `/media/*`. */
export async function readMediaObject(
  env: Env,
  key: string,
): Promise<MediaBucketObject | null> {
  return getMediaObject(env, key);
}
