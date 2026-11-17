/**
 * Media de la tienda: validación de WebP real, keys inmutables de R2 y URLs
 * públicas construidas **solo** con `MEDIA_BASE_URL` (PLAN §8.5 / §12).
 *
 * El servidor no procesa imágenes: el navegador ya entrega WebP full 1600 px +
 * thumb 600 px. Aquí se comprueba que lo son de verdad (magic bytes + cabecera
 * de dimensiones) y se rechaza lo que no cumpla sin tocar R2 ni D1.
 */
import type { Context } from "hono";
import type { z } from "zod";

import type { ErrorDetail } from "@tucatalogo/types";

import {
  CATALOG_MESSAGES,
  CATALOG_REASONS,
  MEDIA_LIMITS,
} from "../constants/catalog";
import type { Env } from "../env";
import { AppError } from "../errors";

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageUpload extends ImageSize {
  bytes: Uint8Array;
  size: number;
}

function invalid(reason: string, message: string, field: string): AppError {
  const details: ErrorDetail[] = [{ path: field, message }];
  return new AppError("VALIDATION_ERROR", message, details, reason);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return out;
}

/**
 * Dimensiones reales de un WebP (VP8 con pérdida, VP8L sin pérdida o VP8X
 * extendido). `null` si la firma o la cabecera no son válidas.
 */
export function readWebpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 26) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, 4);
    const size = readUint32LE(bytes, offset + 4);
    const data = offset + 8;

    if (fourcc === "VP8 ") {
      if (bytes.length < data + 10) return null;
      if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        return null;
      }
      return {
        width: readUint16LE(bytes, data + 6) & 0x3fff,
        height: readUint16LE(bytes, data + 8) & 0x3fff,
      };
    }

    if (fourcc === "VP8L") {
      if (bytes.length < data + 5 || bytes[data] !== 0x2f) return null;
      const header = readUint32LE(bytes, data + 1);
      return {
        width: (header & 0x3fff) + 1,
        height: ((header >> 14) & 0x3fff) + 1,
      };
    }

    if (fourcc === "VP8X") {
      if (bytes.length < data + 10) return null;
      const width = 1 + (bytes[data + 4] ?? 0) + ((bytes[data + 5] ?? 0) << 8) + ((bytes[data + 6] ?? 0) << 16);
      const height = 1 + (bytes[data + 7] ?? 0) + ((bytes[data + 8] ?? 0) << 8) + ((bytes[data + 9] ?? 0) << 16);
      return { width, height };
    }

    // Chunk desconocido: se salta (RIFF exige tamaño par).
    offset = data + size + (size % 2);
  }

  return null;
}

/**
 * Valida un objeto ya normalizado: WebP real, ≤ 2 MB y ancho ≤ `maxWidth`.
 * Lanza 400 con `details` del campo; nunca 500.
 */
export function assertWebpImage(
  bytes: Uint8Array,
  options: { field: string; maxWidth: number; maxBytes?: number },
): ImageSize {
  const maxBytes = options.maxBytes ?? MEDIA_LIMITS.maxBytes;
  if (bytes.byteLength === 0) {
    throw invalid(CATALOG_REASONS.imageMissing, CATALOG_MESSAGES.imageMissing, options.field);
  }
  if (bytes.byteLength > maxBytes) {
    throw invalid(CATALOG_REASONS.imageTooLarge, CATALOG_MESSAGES.imageTooLarge, options.field);
  }

  const size = readWebpSize(bytes);
  if (!size) {
    throw invalid(CATALOG_REASONS.imageType, CATALOG_MESSAGES.imageType, options.field);
  }
  if (size.width <= 0 || size.height <= 0 || size.height > 20_000) {
    throw invalid(
      CATALOG_REASONS.imageDimensions,
      CATALOG_MESSAGES.imageDimensions,
      options.field,
    );
  }
  if (size.width > options.maxWidth) {
    throw invalid(
      CATALOG_REASONS.imageDimensions,
      `${CATALOG_MESSAGES.imageDimensions} Máximo ${options.maxWidth} px de ancho.`,
      options.field,
    );
  }
  return size;
}

/** ¿El valor de un campo multipart es un fichero? */
export function isFilePart(value: unknown): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
      typeof (value as { size?: unknown }).size === "number",
  );
}

/** Lee y valida una parte de fichero de un `multipart/form-data`. */
export async function readImageUpload(
  part: unknown,
  options: { field: string; maxWidth: number },
): Promise<ImageUpload> {
  if (!isFilePart(part)) {
    throw invalid(CATALOG_REASONS.imageMissing, CATALOG_MESSAGES.imageMissing, options.field);
  }

  const size = part.size;
  if (size > MEDIA_LIMITS.maxBytes) {
    throw invalid(CATALOG_REASONS.imageTooLarge, CATALOG_MESSAGES.imageTooLarge, options.field);
  }

  const buffer = new Uint8Array(await part.arrayBuffer());
  const dimensions = assertWebpImage(buffer, options);
  return { bytes: buffer, size: buffer.byteLength, ...dimensions };
}

/** Campos de texto de un `multipart/form-data` (sin los ficheros). */
export function textFields(body: Record<string, string | File>): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      fields[key] = trimmed === "" ? undefined : trimmed;
    }
  }
  return fields;
}

/**
 * `MEDIA_BASE_URL` es obligatoria y única (PLAN §8.5 / §12): sin barra final,
 * con esquema http(s). Falta o está mal formada → 503 + log, sin inventar host.
 */
export function requireMediaBaseUrl(env: Env): string {
  const raw = env.MEDIA_BASE_URL?.trim();
  if (!raw) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Falta MEDIA_BASE_URL: no se construyen URLs de media",
        variable: "MEDIA_BASE_URL",
      }),
    );
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      CATALOG_MESSAGES.mediaBaseMissing,
      undefined,
      CATALOG_REASONS.mediaBaseMissing,
    );
  }
  if (raw.endsWith("/") || raw.replace(/^https?:\/\//i, "").includes("//")) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "MEDIA_BASE_URL mal formada (barra final o doble barra)",
        variable: "MEDIA_BASE_URL",
      }),
    );
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      CATALOG_MESSAGES.mediaBaseMissing,
      undefined,
      CATALOG_REASONS.mediaBaseMissing,
    );
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  } catch {
    console.error(
      JSON.stringify({
        level: "error",
        message: "MEDIA_BASE_URL mal formada (no es una URL absoluta)",
        variable: "MEDIA_BASE_URL",
      }),
    );
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      CATALOG_MESSAGES.mediaBaseMissing,
      undefined,
      CATALOG_REASONS.mediaBaseMissing,
    );
  }
  return raw;
}

/** URL pública de un objeto: `MEDIA_BASE_URL` + `/` + key (sin dobles barras). */
export function mediaUrl(baseUrl: string, key: string | null): string | null {
  if (!key) return null;
  return `${baseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

/** Base aleatoria de una imagen de producto (full/thumb se derivan). */
export function productImageKeyBase(storeId: string, productId: string): string {
  return `stores/${storeId}/products/${productId}/${crypto.randomUUID()}`;
}

/** Objetos derivados de la base de una imagen de producto (PLAN §6.8.1). */
export function productImageObjects(keyBase: string): { full: string; thumb: string } {
  return { full: `${keyBase}-full.webp`, thumb: `${keyBase}-thumb.webp` };
}

/** Objetos de una variante del hero (recortes distintos, no escalados). */
export function heroImageObjects(
  storeId: string,
  slideId: string,
): { desktop: string; mobile: string } {
  const base = `stores/${storeId}/hero/${slideId}/${crypto.randomUUID()}`;
  return { desktop: `${base}-desktop.webp`, mobile: `${base}-mobile.webp` };
}

/** Objeto del logo de la tienda. */
export function storeLogoObject(storeId: string): string {
  return `stores/${storeId}/logo/${crypto.randomUUID()}.webp`;
}

/**
 * Key servible por `/media/*`: solo bajo `stores/`, sin traversal, sin barras
 * dobles y sin segmentos vacíos. Cualquier otra cosa es 404.
 */
export function isSafeMediaKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (!key.startsWith("stores/")) return false;
  if (key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  if (key.startsWith("/") || key.endsWith("/")) return false;
  return /^stores\/[A-Za-z0-9._/-]+$/.test(key);
}

/** Cuerpo multipart del request (Hono lo parsea, aquí solo se tipa). */
export async function readMultipart(c: Context): Promise<Record<string, string | File>> {
  try {
    return await c.req.parseBody();
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "El formulario no es multipart válido.",
      undefined,
      CATALOG_REASONS.imageMissing,
    );
  }
}

/** Valida los campos de texto del multipart con un schema de Zod. */
export function parseFormFields<S extends z.ZodType>(
  fields: Record<string, unknown>,
  schema: S,
): z.infer<S> {
  const result = schema.safeParse(fields);
  if (!result.success) {
    const details: ErrorDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join(".") || "(root)",
      message: issue.message,
    }));
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.invalidPayload,
      details,
    );
  }
  return result.data;
}
