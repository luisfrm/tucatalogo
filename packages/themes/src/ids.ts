/**
 * IDs oficiales del MVP (PLAN §10.3). Los 5 temas están implementados en
 * `themes/`; `getTheme` nunca cae a un default aunque el id llegue corrupto.
 */
export const THEME_IDS = [
  "rose",
  "nude-studio",
  "velvet-noir",
  "sol-de-verano",
  "urban-slate",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
