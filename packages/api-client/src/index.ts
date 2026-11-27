export {
  ApiTransportError,
  SERVICE_BINDING_BASE_URL,
  createApiTransport,
  cookieHeadersFrom,
} from "./transport";
export type {
  ApiServiceBinding,
  ApiTransport,
  ApiTransportOptions,
} from "./transport";

export { createApiClient } from "./client";
export type { ApiClient, HonoRpcClient } from "./client";

export {
  ApiClientError,
  apiHeaders,
  apiSetCookies,
  copyApiSetCookies,
  readApiJson,
  readApiVoid,
  // Auth tienda
  checkStoreSlug,
  signupStoreOtp,
  signupStore,
  loginStore,
  readStoreSession,
  logoutStore,
  forgotStorePassword,
  resetStorePassword,
  // Auth console
  getConsoleInitStatus,
  initConsole,
  loginConsole,
  verifyConsoleTwoFactor,
  setupConsoleTwoFactor,
  readConsoleSession,
  logoutConsole,
  forgotConsolePassword,
  resetConsolePassword,
  // Público
  getPublicStore,
  getPublicHero,
  listPublicProducts,
  getPublicProduct,
  getPublicSitemap,
  listPublicCategories,
  // Panel — tienda
  getPanelStore,
  updatePanelStore,
  uploadStoreLogo,
  deleteStoreLogo,
  suspendPanelStore,
  reactivatePanelStore,
  deletePanelStore,
  // Panel — productos
  listPanelProducts,
  createPanelProduct,
  getPanelProduct,
  updatePanelProduct,
  deletePanelProduct,
  setPanelProductStatus,
  reorderPanelProducts,
  uploadPanelProductImage,
  updatePanelProductImage,
  deletePanelProductImage,
  reorderPanelProductImages,
  // Panel — categorías y hero
  listPanelCategories,
  createPanelCategory,
  updatePanelCategory,
  deletePanelCategory,
  reorderPanelCategories,
  listPanelHero,
  createPanelHero,
  updatePanelHero,
  deletePanelHero,
  reorderPanelHero,
  replacePanelHeroImages,
  // Console
  listConsoleStores,
  getConsoleStore,
  suspendConsoleStore,
  reactivateConsoleStore,
  deleteConsoleStore,
  listConsoleAudit,
} from "./domain";
export type {
  ApiCallResult,
  ApiContext,
  ConsoleLoginResult,
  ConsoleTwoFactorSetupResult,
} from "./domain";
