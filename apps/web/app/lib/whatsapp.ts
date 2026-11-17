/**
 * WhatsApp: el API entrega `whatsappUrl` ya construida con la plantilla de la
 * tienda (`{producto}`, `{precio}`, `{tienda}`) y el número configurado.
 * Sin número llega `null` y el botón no se renderiza.
 *
 * Solo se aceptan URLs `https://wa.me/...`; cualquier otra cosa se oculta. No se
 * reconstruye la URL en el storefront: la plantilla vive en un solo sitio.
 */
export function resolveWhatsappLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "wa.me") return null;
    return url;
  } catch {
    return null;
  }
}
