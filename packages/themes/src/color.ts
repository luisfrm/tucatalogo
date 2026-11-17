import type { ColorMode } from "@tucatalogo/types";

import type { ThemeTokens } from "./tokens";

/**
 * Motor de color OKLCH (PLAN §10.6).
 *
 * Entrada: color principal del cliente (`#RRGGBB`) + tema + modo.
 * Derivados: primary, hover, subtle, ring, on-primary y accent, ajustando
 * L/C hasta cumplir WCAG AA (4.5:1 texto normal, 3:1 UI). Todo el módulo es
 * puro y determinista: sin estado, sin aleatoriedad, sin dependencias.
 */

/** Error tipado de entrada (PLAN §12: color inválido al escribir → 400). */
export class InvalidColorError extends Error {
  readonly status = 400;
  readonly code = "INVALID_COLOR";

  constructor(readonly value: unknown) {
    super(
      `Color inválido: ${String(value)}. Se espera un hexadecimal #RRGGBB.`,
    );
    this.name = "InvalidColorError";
  }
}

export interface Rgb {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
}

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  /** Luminosidad perceptual 0–1. */
  l: number;
  /** Croma ≥ 0 (sRGB práctico < 0.4). */
  c: number;
  /** Tono en grados 0–360. */
  h: number;
}

/** Contraste AA para texto normal. */
export const AA_TEXT = 4.5;
/** Contraste AA para texto grande y componentes de UI. */
export const AA_UI = 3;

/** Casi negro usado como `on-primary` cuando el primario es claro. */
export const NEAR_BLACK = "#0F0D0E";
/** Blanco de referencia para `on-primary` cuando el primario es oscuro. */
export const NEAR_WHITE = "#FFFFFF";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

export function parseHex(hex: string): Rgb {
  if (!isHexColor(hex)) {
    throw new InvalidColorError(hex);
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp01(value / 255) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

export function srgbToLinear(rgb: Rgb): LinearRgb {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return { r: toLinear(rgb.r), g: toLinear(rgb.g), b: toLinear(rgb.b) };
}

export function linearToSrgb(linear: LinearRgb): Rgb {
  const toChannel = (value: number) => {
    const c =
      value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
    return clamp01(c) * 255;
  };
  return { r: toChannel(linear.r), g: toChannel(linear.g), b: toChannel(linear.b) };
}

/* ------------------------------------------------------------------ *
 * OKLab / OKLCH (Björn Ottosson, 2020)
 * ------------------------------------------------------------------ */

export function linearSrgbToOklab(linear: LinearRgb): {
  l: number;
  a: number;
  b: number;
} {
  const { r, g, b } = linear;
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

export function oklabToLinearSrgb(lab: {
  l: number;
  a: number;
  b: number;
}): LinearRgb {
  const lRoot = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const mRoot = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const sRoot = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function oklchToOklab(color: Oklch): { l: number; a: number; b: number } {
  const radians = (color.h * Math.PI) / 180;
  return {
    l: color.l,
    a: color.c * Math.cos(radians),
    b: color.c * Math.sin(radians),
  };
}

export function oklabToOklch(lab: {
  l: number;
  a: number;
  b: number;
}): Oklch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const h =
    c < 1e-7 ? 0 : (((Math.atan2(lab.b, lab.a) * 180) / Math.PI) % 360 + 360) % 360;
  return { l: lab.l, c, h: round(h, 4) };
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(linearSrgbToOklab(srgbToLinear(parseHex(hex))));
}

function isInGamut(linear: LinearRgb): boolean {
  const epsilon = 1e-4;
  return (
    linear.r >= -epsilon &&
    linear.r <= 1 + epsilon &&
    linear.g >= -epsilon &&
    linear.g <= 1 + epsilon &&
    linear.b >= -epsilon &&
    linear.b <= 1 + epsilon
  );
}

/**
 * OKLCH → hex con *gamut mapping* por reducción de croma: nunca se recorta
 * el canal a la brava (eso desplaza el tono). Si el croma es imposible en
 * sRGB, se baja hasta el máximo representable.
 */
export function oklchToHex(color: Oklch): string {
  const l = clamp01(color.l);
  const h = ((color.h % 360) + 360) % 360;
  const c = Math.max(0, color.c);

  let linear = oklabToLinearSrgb(oklchToOklab({ l, c, h }));
  if (!isInGamut(linear)) {
    let low = 0;
    let high = c;
    for (let i = 0; i < 32; i += 1) {
      const mid = (low + high) / 2;
      const candidate = oklabToLinearSrgb(oklchToOklab({ l, c: mid, h }));
      if (isInGamut(candidate)) {
        low = mid;
      } else {
        high = mid;
      }
    }
    linear = oklabToLinearSrgb(oklchToOklab({ l, c: low, h }));
  }

  return rgbToHex(linearToSrgb(linear));
}

/* ------------------------------------------------------------------ *
 * Contraste WCAG 2.x
 * ------------------------------------------------------------------ */

export function relativeLuminance(hex: string): number {
  const { r, g, b } = srgbToLinear(parseHex(hex));
  return round(0.2126 * r + 0.7152 * g + 0.0722 * b, 6);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return round((lighter + 0.05) / (darker + 0.05), 3);
}

export function contrastRatioOklch(
  foreground: Oklch,
  background: string,
): number {
  return contrastRatio(oklchToHex(foreground), background);
}

export function meetsContrast(
  foreground: string,
  background: string,
  minimum: number,
): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

/* ------------------------------------------------------------------ *
 * Manipulación
 * ------------------------------------------------------------------ */

export function shiftLightness(color: Oklch, delta: number): Oklch {
  return { ...color, l: clamp01(color.l + delta) };
}

export function withLightness(color: Oklch, l: number): Oklch {
  return { ...color, l: clamp01(l) };
}

export function withChroma(color: Oklch, c: number): Oklch {
  return { ...color, c: Math.max(0, c) };
}

/** Interpolación circular de tono por el arco más corto (t = 0 devuelve `from`). */
export function mixHue(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return round((((from + delta * clamp01(t)) % 360) + 360) % 360, 4);
}

/**
 * Gira el tono de `from` hacia `to` como mucho `maxRotation` grados.
 * Evita que un acento de identidad fuerte (oro, teal) acabe en un tercer
 * tono irreconocible cuando el cliente elige un color casi complementario:
 * si el tono está a más de 120° no se gira nada y el acento mantiene la
 * identidad del tema.
 */
export function blendHue(
  from: number,
  to: number,
  amount: number,
  maxRotation = 30,
): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  if (Math.abs(delta) > 120) {
    return round(((from % 360) + 360) % 360, 4);
  }
  const rotation = Math.max(
    -maxRotation,
    Math.min(maxRotation, delta * clamp01(amount)),
  );
  return round((((from + rotation) % 360) + 360) % 360, 4);
}

export interface EnsureContrastOptions {
  /** Dirección preferida. Por defecto, la que más contraste gana. */
  direction?: "darken" | "lighten";
  /** Pasos de la búsqueda binaria (fijos para mantener el determinismo). */
  steps?: number;
}

/**
 * Ajusta la L de `color` lo mínimo necesario para alcanzar `target` contra
 * `background`. La comprobación se hace siempre sobre el hex final (tras el
 * redondeo a 8 bits), así el valor devuelto cumple el contraste de verdad.
 */
export function ensureContrast(
  color: Oklch,
  background: string,
  target: number,
  options: EnsureContrastOptions = {},
): Oklch {
  const bg = parseHex(background);
  const bgLuminance = (() => {
    const { r, g, b } = srgbToLinear(bg);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  })();

  const contrastAt = (l: number) => {
    const hex = oklchToHex({ ...color, l: clamp01(l) });
    const { r, g, b } = srgbToLinear(parseHex(hex));
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const lighter = Math.max(luminance, bgLuminance);
    const darker = Math.min(luminance, bgLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const start = clamp01(color.l);
  if (contrastAt(start) >= target) {
    return { ...color, l: start };
  }

  const darkenGain = contrastAt(0) - contrastAt(start);
  const lightenGain = contrastAt(1) - contrastAt(start);
  const darken =
    options.direction === "darken"
      ? true
      : options.direction === "lighten"
        ? false
        : darkenGain >= lightenGain;

  const extreme = darken ? 0 : 1;
  if (contrastAt(extreme) < target) {
    // Inalcanzable incluso en el extremo: se devuelve el extremo y el
    // consumidor decide (los tests de contraste lo detectan).
    return { ...color, l: extreme };
  }

  let failing = start;
  let passing = extreme;
  const steps = options.steps ?? 32;
  for (let i = 0; i < steps; i += 1) {
    const mid = (failing + passing) / 2;
    if (contrastAt(mid) >= target) {
      passing = mid;
    } else {
      failing = mid;
    }
  }

  return { ...color, l: passing };
}

/** Elige el `on-*` con más contraste real entre casi blanco y casi negro. */
export function pickOnColor(background: string): string {
  return contrastRatio(NEAR_WHITE, background) >=
    contrastRatio(NEAR_BLACK, background)
    ? NEAR_WHITE
    : NEAR_BLACK;
}

/* ------------------------------------------------------------------ *
 * Derivación por tema
 * ------------------------------------------------------------------ */

/**
 * Identidad cromática de un tema: qué parte del color del cliente se respeta,
 * cuánto se recorta el croma y cómo se construye el acento.
 */
export interface ThemeColorProfile {
  /** Uso del primario: relleno de botón, texto/enlace o ambos. */
  primaryUsage: "fill" | "text" | "both";
  /** Techo de croma del primario (evita neones fuera de la identidad). */
  primaryChromaMax: number;
  /** Desplazamiento de L del hover (el signo lo decide el modo). */
  hoverShift: number;
  /** L del fondo sutil (`primary-subtle`) por modo. */
  subtleLightness: Record<ColorMode, number>;
  /** Fracción del croma del cliente que conserva el fondo sutil. */
  subtleChromaFactor: number;
  /** Techo de croma del fondo sutil (un sutil nunca es un color sólido). */
  subtleChromaMax: number;
  /** Peso del tono del cliente en el acento (0 = tono del tema, 1 = cliente). */
  accentHueBlend: number;
  /** Giro máximo del tono del acento, en grados, hacia el color del cliente. */
  accentHueMaxRotation: number;
  /** Techo de croma del acento. */
  accentChromaMax: number;
  /** Contraste mínimo exigido al acento contra la superficie. */
  accentContrast: number;
}

export interface DerivedPrimaryTokens {
  primary: string;
  onPrimary: string;
  primaryHover: string;
  primarySubtle: string;
  ring: string;
  accent: string;
  accentOn: string;
}

export interface DerivePrimaryInput {
  /** Color del cliente, `#RRGGBB`. */
  primaryColor: string;
  mode: ColorMode;
  /** Tokens estáticos del tema: aportan fondos, texto e identidad del acento. */
  base: ThemeTokens;
  profile: ThemeColorProfile;
}

const DERIVED_KEYS = [
  "primary",
  "onPrimary",
  "primaryHover",
  "primarySubtle",
  "ring",
  "accent",
  "accentOn",
] as const satisfies readonly (keyof ThemeTokens)[];

/**
 * Deriva la familia del primario desde el color del cliente.
 *
 * Orden (determinista):
 * 1. `primarySubtle`: fondo teñido del tema que mantiene el texto legible.
 * 2. `primary`: recorta croma y ajusta L hasta AA sobre superficie, fondo y
 *    sutil (un chip con texto primario también tiene que leerse).
 * 3. `onPrimary`: se elige por contraste real; si ninguno de los dos alcanza
 *    AA, se sigue moviendo la L del primario hasta que lo cumpla.
 * 4. `primaryHover`: mismo tono, L desplazada hacia el lado con más contraste
 *    manteniendo AA del texto y 3:1 contra la superficie.
 * 5. `ring`: el primario llevado a 3:1 sobre el fondo (foco visible).
 * 6. `accent`: tono del tema mezclado con el del cliente, a 4.5:1 sobre
 *    superficie, con `accentOn` elegido por contraste.
 */
export function derivePrimaryTokens({
  primaryColor,
  mode,
  base,
  profile,
}: DerivePrimaryInput): DerivedPrimaryTokens {
  const source = hexToOklch(primaryColor);
  const chroma = Math.min(source.c, profile.primaryChromaMax);
  const seed: Oklch = { l: source.l, c: chroma, h: source.h };
  const textTarget = profile.primaryUsage === "fill" ? AA_UI : AA_TEXT;

  // 1. Fondo sutil: teñido pero con el texto del tema legible encima.
  const subtleSeed: Oklch = {
    l: profile.subtleLightness[mode],
    c: Math.min(chroma * profile.subtleChromaFactor, profile.subtleChromaMax),
    h: source.h,
  };
  let subtle = ensureContrast(subtleSeed, base.text, AA_TEXT, {
    direction: mode === "dark" ? "darken" : "lighten",
  });
  // Visible sobre la superficie pero sin convertirse en un color sólido.
  subtle = ensureContrast(subtle, base.surface, 1.06, {
    direction: mode === "dark" ? "lighten" : "darken",
  });
  const subtleHex = oklchToHex(subtle);

  // 2. Primario: texto/enlace y relleno de botón sobre los tres fondos reales.
  let primary = ensureContrast(seed, base.surface, textTarget);
  primary = ensureContrast(primary, base.bg, textTarget);
  primary = ensureContrast(primary, subtleHex, AA_TEXT);

  // 3. on-primary por contraste real, garantizando AA del texto del botón.
  let onPrimary = pickOnColor(oklchToHex(primary));
  for (let i = 0; i < 2; i += 1) {
    const adjusted = ensureContrast(primary, onPrimary, AA_TEXT);
    const nextOn = pickOnColor(oklchToHex(adjusted));
    const stable =
      oklchToHex(adjusted) === oklchToHex(primary) && nextOn === onPrimary;
    primary = adjusted;
    onPrimary = nextOn;
    if (stable) {
      break;
    }
  }
  const primaryHex = oklchToHex(primary);

  // 4. Hover: en claro se oscurece, en oscuro se aclara (más contraste del texto).
  const hoverDirection = mode === "dark" ? "lighten" : "darken";
  let hover = shiftLightness(
    primary,
    hoverDirection === "lighten" ? profile.hoverShift : -profile.hoverShift,
  );
  hover = ensureContrast(hover, onPrimary, AA_TEXT, {
    direction: hoverDirection,
  });
  hover = ensureContrast(hover, base.surface, AA_UI, {
    direction: hoverDirection,
  });
  const hoverHex = oklchToHex(hover);

  // 5. Anillo de foco: 3:1 sobre el fondo real.
  const ringHex = oklchToHex(
    ensureContrast(primary, base.bg, AA_UI, { direction: hoverDirection }),
  );

  // 6. Acento: tono del tema mezclado con el del cliente.
  const themeAccent = hexToOklch(base.accent);
  const accentSeed: Oklch = {
    l: themeAccent.l,
    c: Math.min(Math.max(themeAccent.c, chroma * 0.6), profile.accentChromaMax),
    h: blendHue(
      themeAccent.h,
      source.h,
      profile.accentHueBlend,
      profile.accentHueMaxRotation,
    ),
  };
  const accentDirection = mode === "dark" ? "lighten" : "darken";
  let accent = ensureContrast(accentSeed, base.surface, profile.accentContrast, {
    direction: accentDirection,
  });
  accent = ensureContrast(accent, base.bg, profile.accentContrast, {
    direction: accentDirection,
  });
  let accentHex = oklchToHex(accent);
  let accentOn = pickOnColor(accentHex);
  accent = ensureContrast(accent, accentOn, AA_TEXT, { direction: accentDirection });
  accentHex = oklchToHex(accent);
  accentOn = pickOnColor(accentHex);

  return {
    primary: primaryHex,
    onPrimary,
    primaryHover: hoverHex,
    primarySubtle: subtleHex,
    ring: ringHex,
    accent: accentHex,
    accentOn,
  };
}

/**
 * Aplica el color del cliente sobre los tokens estáticos de un tema.
 * Devuelve un objeto nuevo: nunca muta la definición del tema.
 */
export function applyPrimaryColor(
  tokens: ThemeTokens,
  mode: ColorMode,
  primaryColor: string,
  profile: ThemeColorProfile,
): ThemeTokens {
  const derived = derivePrimaryTokens({
    primaryColor,
    mode,
    base: tokens,
    profile,
  });
  return { ...tokens, ...derived };
}

export { DERIVED_KEYS };
