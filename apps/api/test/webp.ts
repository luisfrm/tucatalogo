/**
 * Generador de WebP válidos para los tests (VP8L sin pérdida, cabecera real).
 * El API no decodifica píxeles: valida firma RIFF/WEBP y dimensiones.
 */

const CHUNK_HEADER = 8;

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function uint32LE(value: number): number[] {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

/**
 * WebP VP8L de `width` × `height`. Los bits de la cabecera VP8L van LSB-first:
 * 14 bits de ancho-1, 14 de alto-1, 1 de alfa y 3 de versión.
 */
export function webpImage(
  width = 1600,
  height = 1000,
  options: { padToBytes?: number } = {},
): Uint8Array {
  const header = (((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)) >>> 0;
  const chunkData = [0x2f, ...uint32LE(header)];
  const chunk = [...chunkData, 0x00]; // tamaño impar: RIFF exige padding par

  const riffSize = 4 + CHUNK_HEADER + chunk.length;
  const bytes = [
    ...ascii("RIFF"),
    ...uint32LE(riffSize),
    ...ascii("WEBP"),
    ...ascii("VP8L"),
    ...uint32LE(chunkData.length),
    ...chunk,
  ];

  const result = new Uint8Array(Math.max(bytes.length, options.padToBytes ?? 0));
  result.set(bytes, 0);
  return result;
}

/** Firma PNG: WebP real falso (magic bytes inválidos). */
export function pngBytes(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

/** FormData de una imagen de producto (full + thumb + alt). */
export function productImageForm(
  options: { fullWidth?: number; thumbWidth?: number; alt?: string; full?: Uint8Array } = {},
): FormData {
  const form = new FormData();
  const full = options.full ?? webpImage(options.fullWidth ?? 1600, 1000);
  form.append("full", new File([full], "full.webp", { type: "image/webp" }));
  form.append(
    "thumb",
    new File([webpImage(options.thumbWidth ?? 600, 600)], "thumb.webp", { type: "image/webp" }),
  );
  form.append("alt", options.alt ?? "Zapato de muestra");
  return form;
}

/** FormData de un slide de hero (desktop + mobile + textos). */
export function heroForm(fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append(
    "desktop",
    new File([webpImage(1600, 700)], "desktop.webp", { type: "image/webp" }),
  );
  form.append("mobile", new File([webpImage(900, 1200)], "mobile.webp", { type: "image/webp" }));
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

/** FormData del logo de la tienda. */
export function logoForm(width = 800, height = 400): FormData {
  const form = new FormData();
  form.append("logo", new File([webpImage(width, height)], "logo.webp", { type: "image/webp" }));
  return form;
}
