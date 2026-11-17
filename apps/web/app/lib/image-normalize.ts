/**
 * Normalización de imágenes **en el navegador** (PLAN §4.5 E / §6.8.1).
 *
 * - Entrada: JPG/PNG/WebP de hasta 2 MB.
 * - Salida: WebP real (nunca se sube otro formato), EXIF eliminado al reencodar.
 * - Producto: full 1600 px de ancho + thumb 600 px, sin recortar.
 * - Hero: desktop 1600×900 y mobile 900×1200 con recorte centrado.
 *
 * El API revalida magic bytes, tamaño y dimensiones: esto es solo la primera
 * barrera y la que evita subir archivos que el servidor va a rechazar.
 */
export const IMAGE_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const PRODUCT_FULL_WIDTH = 1600;
export const PRODUCT_THUMB_WIDTH = 600;
export const PRODUCT_IMAGE_QUALITY = 0.86;

export const HERO_DESKTOP_WIDTH = 1600;
export const HERO_DESKTOP_HEIGHT = 900;
export const HERO_MOBILE_WIDTH = 900;
export const HERO_MOBILE_HEIGHT = 1200;
export const HERO_IMAGE_QUALITY = 0.88;

export const LOGO_MAX_WIDTH = 1600;

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageNormalizationError";
  }
}

export interface SourceFileInfo {
  size: number;
  type: string;
}

export interface NormalizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface FitSize {
  width: number;
  height: number;
}

/** Valida el archivo elegido sin leerlo. Devuelve el mensaje de error o `null`. */
export function validateSourceImage(file: SourceFileInfo): string | null {
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > IMAGE_INPUT_MAX_BYTES) {
    return "La imagen supera el máximo de 2 MB. Elige una más ligera.";
  }
  if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(file.type)) {
    return "Formato no admitido. Usa JPG, PNG o WebP.";
  }
  return null;
}

/** Escala proporcional sin ampliar: ancho máximo `maxWidth`. */
export function computeFitSize(width: number, height: number, maxWidth: number): FitSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ImageNormalizationError("La imagen no tiene dimensiones válidas.");
  }
  if (maxWidth <= 0) throw new ImageNormalizationError("El ancho de destino no es válido.");

  const scale = Math.min(1, maxWidth / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Recorte centrado (cover) para las dos variantes del hero. */
export function computeCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new ImageNormalizationError("La imagen no tiene dimensiones válidas.");
  }

  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  if (sourceRatio > targetRatio) {
    const sw = Math.round(sourceHeight * targetRatio);
    return {
      sx: Math.round((sourceWidth - sw) / 2),
      sy: 0,
      sw,
      sh: sourceHeight,
    };
  }

  const sh = Math.round(sourceWidth / targetRatio);
  return {
    sx: 0,
    sy: Math.round((sourceHeight - sh) / 2),
    sw: sourceWidth,
    sh,
  };
}

function canvasToWebp(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageNormalizationError("No pudimos codificar la imagen."));
      },
      "image/webp",
      quality,
    );
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === "undefined") {
    throw new ImageNormalizationError("El navegador no puede procesar imágenes aquí.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Comprobación explícita de soporte WebP. `toDataURL` cae a PNG en silencio
 * cuando el navegador no soporta WebP; en ese caso no se sube nada.
 */
export function supportsWebpEncoding(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  if (typeof document === "undefined") {
    throw new ImageNormalizationError("El navegador no puede leer la imagen.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ImageNormalizationError("No pudimos leer la imagen."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

export async function normalizeImage(
  file: File,
  spec: {
    mode: "fit" | "cover";
    maxWidth: number;
    width?: number;
    height?: number;
    quality?: number;
  },
): Promise<NormalizedImage> {
  const invalid = validateSourceImage(file);
  if (invalid) throw new ImageNormalizationError(invalid);

  if (!supportsWebpEncoding()) {
    throw new ImageNormalizationError(
      "Tu navegador no puede generar WebP. Actualízalo para subir imágenes; no aceptamos otro formato.",
    );
  }

  const source = await loadBitmap(file);
  const { width: sourceWidth, height: sourceHeight } = sourceSize(source);

  let outWidth: number;
  let outHeight: number;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (spec.mode === "cover") {
    outWidth = spec.width ?? spec.maxWidth;
    outHeight = spec.height ?? Math.round(outWidth * (sourceHeight / sourceWidth));
    const crop = computeCoverCrop(sourceWidth, sourceHeight, outWidth, outHeight);
    sx = crop.sx;
    sy = crop.sy;
    sw = crop.sw;
    sh = crop.sh;
  } else {
    const fit = computeFitSize(sourceWidth, sourceHeight, spec.maxWidth);
    outWidth = fit.width;
    outHeight = fit.height;
  }

  const canvas = createCanvas(outWidth, outHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new ImageNormalizationError("No pudimos preparar el lienzo de la imagen.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

  const blob = await canvasToWebp(canvas, spec.quality ?? PRODUCT_IMAGE_QUALITY);

  if (blob.type !== "image/webp") {
    throw new ImageNormalizationError(
      "El navegador devolvió otro formato. No subimos imágenes que no sean WebP.",
    );
  }
  if (blob.size > IMAGE_INPUT_MAX_BYTES) {
    throw new ImageNormalizationError(
      "La imagen sigue superando los 2 MB después de optimizarla. Prueba con otra.",
    );
  }

  if ("close" in source && typeof source.close === "function") source.close();

  return { blob, width: outWidth, height: outHeight };
}

/** Par full+thumb de un producto, ambos derivados del archivo original. */
export async function normalizeProductImage(file: File): Promise<{
  full: NormalizedImage;
  thumb: NormalizedImage;
}> {
  const [full, thumb] = await Promise.all([
    normalizeImage(file, {
      mode: "fit",
      maxWidth: PRODUCT_FULL_WIDTH,
      quality: PRODUCT_IMAGE_QUALITY,
    }),
    normalizeImage(file, {
      mode: "fit",
      maxWidth: PRODUCT_THUMB_WIDTH,
      quality: PRODUCT_IMAGE_QUALITY,
    }),
  ]);
  return { full, thumb };
}

/** Variantes del hero con los encuadres del storefront. */
export async function normalizeHeroDesktop(file: File): Promise<NormalizedImage> {
  return normalizeImage(file, {
    mode: "cover",
    maxWidth: HERO_DESKTOP_WIDTH,
    width: HERO_DESKTOP_WIDTH,
    height: HERO_DESKTOP_HEIGHT,
    quality: HERO_IMAGE_QUALITY,
  });
}

export async function normalizeHeroMobile(file: File): Promise<NormalizedImage> {
  return normalizeImage(file, {
    mode: "cover",
    maxWidth: HERO_MOBILE_WIDTH,
    width: HERO_MOBILE_WIDTH,
    height: HERO_MOBILE_HEIGHT,
    quality: HERO_IMAGE_QUALITY,
  });
}

export async function normalizeLogo(file: File): Promise<NormalizedImage> {
  return normalizeImage(file, { mode: "fit", maxWidth: LOGO_MAX_WIDTH, quality: 0.9 });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
