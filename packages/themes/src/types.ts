import type { ColorMode } from "@tucatalogo/types";

import type { ThemeColorProfile } from "./color";
import type { ThemeId } from "./ids";
import type { ThemeTokens } from "./tokens";

/** Familias tipográficas del tema (sin la pila de fallback). */
export interface ThemeFontFamilies {
  heading: string;
  body: string;
}

/** Metadata que consume el picker del registro (PLAN §10.3). */
export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  description: string;
  /** Color de marca por defecto del tema, `#RRGGBB`. */
  defaultPrimaryColor: string;
  /** Muestras para la tarjeta del picker: primario, acento, fondo y superficie. */
  swatches: readonly string[];
  /** Nombres de familia tal como se cargan en `@font-face`. */
  fonts: ThemeFontFamilies;
  /** Modos que el tema implementa. */
  availableModes: readonly ColorMode[];
  /** Modo sugerido para previsualizar el tema (p. ej. dark en Velvet Noir). */
  defaultPreviewMode: ColorMode;
  /** Frases cortas para la tarjeta del picker. */
  highlights: readonly string[];
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Color de marca del cliente (puede requerir ajuste OKLCH para AA). */
  defaultPrimaryColor: string;
  modes: Record<ColorMode, ThemeTokens>;
  /** Perfil del motor OKLCH: cómo se deriva el primario del cliente. */
  colorProfile: ThemeColorProfile;
  fontFamilies: ThemeFontFamilies;
  /** Variables CSS aditivas de personalidad (peso, tracking, radios de tarjeta/botón). */
  styleVars: Readonly<Record<string, string>>;
  /** Metadata del picker derivada del tema (misma fuente de verdad). */
  metadata: ThemeMetadata;
}

export class ThemeNotAvailableError extends Error {
  readonly status = 500;
  readonly code = "THEME_NOT_AVAILABLE";

  constructor(readonly themeId: string) {
    super(`Tema no implementado o desconocido: ${themeId}`);
    this.name = "ThemeNotAvailableError";
  }
}
