/**
 * Metadatos sociales (Open Graph + Twitter Card) de las superficies de marca
 * (`commercial` y `console`).
 *
 * Vive en `shared` porque lo usan dos apps con el mismo contrato de etiquetas;
 * lo único que cambia es el origen y el texto de cada página.
 *
 * Dos decisiones que evitan errores silenciosos:
 * - **URLs absolutas o nada**: `og:image` y `og:url` son de producción
 *   (`https://tucatalogo.live`, `https://console.tucatalogo.live`), no del host
 *   de la petición. Una ruta relativa no la resuelve ningún rastreador, así que
 *   si llega una se lanza: es un error de programación, no un dato del usuario.
 * - **Un solo juego de etiquetas por página**: React Router v8 renderiza solo el
 *   `meta()` de la ruta más profunda (el padre solo se usa si el hijo no define
 *   ninguno), así que cada página compone su juego completo con esta función y
 *   nunca hay `og:title` duplicado.
 */

export interface SocialImage {
  /** URL absoluta de producción. */
  url: string;
  width: number;
  height: number;
  alt: string;
  /** MIME real del fichero servido. */
  type?: string;
}

export interface SocialMeta {
  title: string;
  description: string;
  /** URL canónica absoluta de la página. */
  url: string;
  siteName: string;
  image: SocialImage;
  /** `es_ES` por defecto: el producto solo se publica en español. */
  locale?: string;
  type?: "website" | "article";
  /** `noindex, nofollow` en las superficies que no deben indexarse. */
  robots?: string;
}

/** Etiqueta `<meta>` con forma de descriptor de React Router. */
export interface SocialMetaTag {
  property?: string;
  name?: string;
  content: string;
}

export type SocialMetaDescriptor = SocialMetaTag | { title: string };

function assertAbsoluteHttpsUrl(value: string, field: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[social-meta] ${field} debe ser una URL absoluta; se recibió "${value}".`,
    );
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      `[social-meta] ${field} debe ser https; se recibió "${value}".`,
    );
  }
}

/**
 * Juego completo y ordenado de etiquetas sociales de una página:
 * `title`, `description`, `robots` (si aplica), Open Graph y Twitter Card.
 */
export function socialMetaDescriptors(
  meta: SocialMeta,
): SocialMetaDescriptor[] {
  assertAbsoluteHttpsUrl(meta.url, "url");
  assertAbsoluteHttpsUrl(meta.image.url, "image.url");

  const type = meta.type ?? "website";
  const imageType = meta.image.type ?? "image/png";

  const descriptors: SocialMetaDescriptor[] = [
    { title: meta.title },
    { name: "description", content: meta.description },
  ];

  if (meta.robots) {
    descriptors.push({ name: "robots", content: meta.robots });
  }

  descriptors.push(
    { property: "og:type", content: type },
    { property: "og:site_name", content: meta.siteName },
    { property: "og:locale", content: meta.locale ?? "es_ES" },
    { property: "og:title", content: meta.title },
    { property: "og:description", content: meta.description },
    { property: "og:url", content: meta.url },
    { property: "og:image", content: meta.image.url },
    { property: "og:image:type", content: imageType },
    { property: "og:image:width", content: String(meta.image.width) },
    { property: "og:image:height", content: String(meta.image.height) },
    { property: "og:image:alt", content: meta.image.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: meta.title },
    { name: "twitter:description", content: meta.description },
    { name: "twitter:image", content: meta.image.url },
    { name: "twitter:image:alt", content: meta.image.alt },
  );

  return descriptors;
}

/** Compone una URL absoluta de producción a partir de un host y una ruta. */
export function absoluteUrl(host: string, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://${host}${normalized}`;
}
