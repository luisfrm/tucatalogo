import type { ColorMode } from "@tucatalogo/types";

import { applyPrimaryColor } from "../color";
import { THEME_IDS, type ThemeId } from "../ids";
import type { ThemeTokens } from "../tokens";
import type { ThemeDefinition, ThemeMetadata } from "../types";
import { ThemeNotAvailableError } from "../types";
import { nudeStudioTheme } from "./nude-studio";
import { roseTheme } from "./rose";
import { solDeVeranoTheme } from "./sol-de-verano";
import { urbanSlateTheme } from "./urban-slate";
import { velvetNoirTheme } from "./velvet-noir";

/**
 * Registro de los 5 temas de tienda (PLAN §10.3). Está completo: no existe
 * ningún tema "pendiente" ni se cae a un default si el id no aparece.
 */
const REGISTRY: Record<ThemeId, ThemeDefinition> = {
  rose: roseTheme,
  "nude-studio": nudeStudioTheme,
  "velvet-noir": velvetNoirTheme,
  "sol-de-verano": solDeVeranoTheme,
  "urban-slate": urbanSlateTheme,
};

export const IMPLEMENTED_THEME_IDS: ThemeId[] = [...THEME_IDS];

/**
 * Sin fallback: un tema desconocido lanza. El route lo mapea a 500 (lectura
 * corrupta) o 400 (escritura) según PLAN §12.
 */
export function getTheme(themeId: string): ThemeDefinition {
  const theme = REGISTRY[themeId as ThemeId];
  if (!theme) {
    throw new ThemeNotAvailableError(themeId);
  }
  return theme;
}

export function isThemeImplemented(themeId: string): boolean {
  return Boolean(REGISTRY[themeId as ThemeId]);
}

export function listImplementedThemes(): ThemeDefinition[] {
  return THEME_IDS.map((id) => REGISTRY[id]);
}

/** Metadata para el picker del registro (commercial, F3). */
export function listThemeMetadata(): ThemeMetadata[] {
  return listImplementedThemes().map((theme) => theme.metadata);
}

export function themeMetadata(themeId: string): ThemeMetadata {
  return getTheme(themeId).metadata;
}

export interface ResolveThemeInput {
  themeId: string;
  mode: ColorMode;
  /**
   * Color de la tienda. Si falta se usan los tokens estáticos del tema
   * (preview del picker); si es inválido, lanza `InvalidColorError`.
   */
  primaryColor?: string;
}

/**
 * Tokens finales de una tienda: tema + modo + color del cliente.
 * Puro y determinista; no toca los objetos del registro.
 */
export function resolveThemeTokens({
  themeId,
  mode,
  primaryColor,
}: ResolveThemeInput): ThemeTokens {
  const theme = getTheme(themeId);
  const base = theme.modes[mode];

  if (!base) {
    throw new ThemeNotAvailableError(`${themeId}:${mode}`);
  }
  if (primaryColor === undefined) {
    return { ...base };
  }

  return applyPrimaryColor(base, mode, primaryColor, theme.colorProfile);
}
