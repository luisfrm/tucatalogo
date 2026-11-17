import { renderThemeCssFor, type ThemeMetadata } from "@tucatalogo/themes";

/**
 * CSS de las tarjetas de preview del picker de temas.
 *
 * Devuelve **solo CSS**: `settings-form.tsx` lo mete en un
 * `<style dangerouslySetInnerHTML>`, así que no puede contener etiquetas
 * `<style>` anidadas (eso rompía la hidratación con `<style><style>`).
 */
export function buildThemePreviewCss(
  themes: readonly ThemeMetadata[],
  primaryColor: string,
): string {
  return themes
    .flatMap((theme) => [
      renderThemeCssFor({ themeId: theme.id, mode: "light", primaryColor }),
      renderThemeCssFor({ themeId: theme.id, mode: "dark", primaryColor }),
    ])
    .join("\n");
}
