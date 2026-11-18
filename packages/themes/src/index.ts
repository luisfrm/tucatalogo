export { THEME_IDS } from "./ids";
export type { ThemeId } from "./ids";

export {
  THEME_TOKEN_KEYS,
  THEME_TOKEN_CSS_VARS,
} from "./tokens";
export type { ThemeTokenKey, ThemeTokens } from "./tokens";

export { ThemeNotAvailableError } from "./types";
export type {
  ThemeDefinition,
  ThemeFontFamilies,
  ThemeMetadata,
} from "./types";

export {
  getTheme,
  isThemeImplemented,
  listImplementedThemes,
  listThemeMetadata,
  themeMetadata,
  resolveThemeTokens,
  IMPLEMENTED_THEME_IDS,
} from "./themes/index";
export type { ResolveThemeInput } from "./themes/index";

export {
  ADMIN_SURFACES,
  adminTheme,
  commercialExtraVars,
  commercialTheme,
  consoleExtraVars,
  consoleTheme,
  resolveAdminTheme,
} from "./themes/admin";
export type { AdminSurface, AdminThemeInput } from "./themes/admin";

export {
  AA_TEXT,
  AA_UI,
  InvalidColorError,
  NEAR_BLACK,
  NEAR_WHITE,
  blendHue,
  contrastRatio,
  contrastRatioOklch,
  derivePrimaryTokens,
  applyPrimaryColor,
  ensureContrast,
  hexToOklch,
  isHexColor,
  meetsContrast,
  mixHue,
  oklchToHex,
  parseHex,
  pickOnColor,
  relativeLuminance,
  rgbToHex,
  shiftLightness,
} from "./color";
export type {
  DerivePrimaryInput,
  DerivedPrimaryTokens,
  EnsureContrastOptions,
  LinearRgb,
  Oklch,
  Rgb,
  ThemeColorProfile,
} from "./color";

export {
  BRAND_FONT_SLUGS,
  FONT_BASE_PATH,
  LATIN_UNICODE_RANGE,
  THEME_FONTS,
  THEME_FONT_SLUGS,
  THEME_FONT_FALLBACKS,
  fontPreloadHrefs,
  fontPreloadLinks,
  renderBrandFontFaceCss,
  renderFallbackFontFaceCss,
  renderFontFaceCss,
  renderFontFaceStyleTag,
  themeFontFiles,
  themePreloadLinks,
} from "./fonts";
export type {
  BrandFontSlug,
  FontSlug,
  RenderFontFaceOptions,
  ThemeFontFallback,
  ThemeFontFile,
} from "./fonts";

export {
  COLOR_MODE_ATTRIBUTE,
  SURFACE_ATTRIBUTE,
  THEME_ATTRIBUTE,
  extraVarsToCss,
  renderAdminCss,
  renderAdminStyleTag,
  renderThemeBootstrap,
  renderThemeCss,
  renderThemeCssFor,
  renderThemeStyleTag,
  renderThemeStyleTagFor,
  renderTokensCss,
  surfaceHtmlAttributes,
  surfaceSelector,
  themeHtmlAttributes,
  themeSelector,
  tokensToCssVariables,
} from "./injector";
export type {
  AdminRenderInput,
  ExtraVars,
  RenderCssOptions,
  ThemeBootstrap,
  ThemeRenderInput,
} from "./injector";
