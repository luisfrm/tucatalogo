/**
 * `packages/themes` emite bloques `<style>` completos (SSR sin FOUC). React no
 * permite anidar HTML crudo dentro de un `<style>`, así que el root usa su
 * propio `<style dangerouslySetInnerHTML>` y aquí se quita solo la envoltura.
 */
const STYLE_TAG_PATTERN = /^\s*<style[^>]*>([\s\S]*?)<\/style>\s*$/i;

export function styleTagContent(tag: string): string {
  const match = STYLE_TAG_PATTERN.exec(tag);
  return match ? match[1] : tag;
}

/** Une varios bloques en uno solo para reducir nodos en el `<head>`. */
export function joinStyleTags(tags: readonly string[]): string {
  return tags.map(styleTagContent).join("\n");
}
