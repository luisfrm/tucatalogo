import type { ColorMode } from "@tucatalogo/types";

import { isHexColor, type ThemeColorProfile } from "../color";
import type { ThemeId } from "../ids";
import { THEME_TOKEN_CSS_VARS, THEME_TOKEN_KEYS, type ThemeTokens } from "../tokens";
import type { ThemeDefinition, ThemeFontFamilies } from "../types";

export interface DefineThemeInput {
  id: ThemeId;
  name: string;
  description: string;
  defaultPrimaryColor: string;
  defaultPreviewMode?: ColorMode;
  colorProfile: ThemeColorProfile;
  fonts: ThemeFontFamilies;
  highlights: readonly string[];
  styleVars?: Readonly<Record<string, string>>;
  modes: Record<ColorMode, ThemeTokens>;
}

/**
 * Valida el contrato completo de tokens (§10.2) y deriva la metadata del
 * picker. Un token ausente o un color con formato inválido rompe en carga:
 * no se publica un tema incompleto que luego herede valores de otro (P1).
 */
export function defineTheme(input: DefineThemeInput): ThemeDefinition {
  if (!isHexColor(input.defaultPrimaryColor)) {
    throw new Error(
      `[themes] ${input.id}: defaultPrimaryColor inválido (${input.defaultPrimaryColor}).`,
    );
  }

  for (const mode of ["light", "dark"] as const) {
    const tokens = input.modes[mode];
    if (!tokens) {
      throw new Error(`[themes] ${input.id}: falta el modo ${mode}.`);
    }
    for (const key of THEME_TOKEN_KEYS) {
      const value = tokens[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(
          `[themes] ${input.id}/${mode}: token sin valor (${key}).`,
        );
      }
      if (THEME_TOKEN_CSS_VARS[key].startsWith("--color-") && !isHexColor(value)) {
        throw new Error(
          `[themes] ${input.id}/${mode}: ${key} debe ser hex #RRGGBB (${value}).`,
        );
      }
    }
  }

  const light = input.modes.light;

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    defaultPrimaryColor: input.defaultPrimaryColor,
    modes: input.modes,
    colorProfile: input.colorProfile,
    fontFamilies: input.fonts,
    styleVars: input.styleVars ?? {},
    metadata: {
      id: input.id,
      name: input.name,
      description: input.description,
      defaultPrimaryColor: input.defaultPrimaryColor,
      swatches: [
        light.primary,
        light.accent,
        light.bg,
        light.surface2,
      ],
      fonts: input.fonts,
      availableModes: ["light", "dark"] as const,
      defaultPreviewMode: input.defaultPreviewMode ?? "light",
      highlights: input.highlights,
    },
  };
}
