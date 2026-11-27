/**
 * Funciones de dominio del API (PLAN §9.2).
 *
 * Las usan los loaders/actions de `web`, `commercial` y `console`; el navegador
 * nunca habla con el API. Reenvían la cookie del navegador y devuelven los
 * `Set-Cookie` tal cual los emitió el API (sin reescribir host ni `Domain`).
 *
 * - Lecturas/escrituras JSON: cliente Hono RPC (tipos de `AppType`).
 * - Listados con query, multipart y auth: mismo transporte (`api.fetch`), que
 *   en dev/prod es el service binding.
 */
import type {
  AdminSessionResponse,
  CategoryCreateInput,
  CategoryUpdateInput,
  ConsoleAuditList,
  ConsoleDeleteStoreInput,
  ConsoleInitInput,
  ConsoleInitResponse,
  ConsoleLoginInput,
  ConsoleLoginResponse,
  ConsoleStoreDetail,
  ConsoleStoreList,
  ConsoleStoresQuery,
  ConsoleSuspendStoreInput,
  ForgotPasswordInput,
  HeroReorderInput,
  HeroUpdateInput,
  MediaImage,
  PanelCategory,
  PanelCategoryList,
  PanelDeleteStoreInput,
  PanelHeroList,
  PanelHeroSlide,
  PanelProduct,
  PanelProductList,
  PanelProductsQuery,
  PanelStore,
  PanelStoreLogoResponse,
  PanelStoreUpdateInput,
  PanelSuspendStoreInput,
  ProductCreateInput,
  ProductImageOrderInput,
  ProductImageUpdateInput,
  ProductStatusInput,
  ProductUpdateInput,
  PublicCategoryList,
  PublicHero,
  PublicProductDetail,
  PublicProductList,
  PublicProductsQuery,
  PublicSitemap,
  PublicStore,
  ReorderInput,
  ResetPasswordInput,
  SignupInput,
  SignupOtpInput,
  SignupResponse,
  SlugCheckResponse,
  StoreLoginInput,
  StoreSessionResponse,
  TwoFactorSetupInput,
  TwoFactorSetupResponse,
  TwoFactorVerifyInput,
} from "@tucatalogo/types";

import type { ApiClient } from "./client";

/** Cabeceras internas que fija el worker que atiende el host público. */
export interface ApiContext {
  /** Cookie del navegador, tal cual (`request.headers.get("cookie")`). */
  cookie?: string;
  /** Slug resuelto del `Host` (o `?siteId` en dev). Nunca del navegador. */
  storeSlug?: string;
  /** IP real del cliente, solo para rate limit y `session.ip_address`. */
  clientIp?: string;
}

export interface ApiCallResult<T> {
  data: T;
  /** Copiar a la respuesta del navegador con `copyApiSetCookies`. */
  setCookies: string[];
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason?: string,
    readonly details?: { path: string; message: string }[],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiResponseLike {
  ok: boolean;
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}

export function apiHeaders(context: ApiContext = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (context.cookie) headers.cookie = context.cookie;
  if (context.storeSlug) headers["x-store-slug"] = context.storeSlug;
  if (context.clientIp) headers["x-client-ip"] = context.clientIp;
  return headers;
}

function jsonHeaders(context: ApiContext): Record<string, string> {
  return { ...apiHeaders(context), "content-type": "application/json" };
}

/** Todos los `Set-Cookie` de una respuesta del API (uno por cookie). */
export function apiSetCookies(response: { headers: Headers }): string[] {
  return response.headers.getSetCookie();
}

/** Copia las cookies del API a la respuesta del navegador, sin reescribirlas. */
export function copyApiSetCookies(from: { headers: Headers }, to: Headers): void {
  for (const cookie of apiSetCookies(from)) {
    to.append("set-cookie", cookie);
  }
}

async function toApiClientError(response: ApiResponseLike): Promise<ApiClientError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const envelope = (body as { error?: Record<string, unknown> } | null)?.error;
  if (envelope) {
    return new ApiClientError(
      response.status,
      typeof envelope.code === "string" ? envelope.code : "INTERNAL",
      typeof envelope.message === "string" ? envelope.message : "Error del API.",
      typeof envelope.reason === "string" ? envelope.reason : undefined,
      Array.isArray(envelope.details)
        ? (envelope.details as { path: string; message: string }[])
        : undefined,
      typeof envelope.requestId === "string" ? envelope.requestId : undefined,
    );
  }

  return new ApiClientError(response.status, "INTERNAL", "Error del API.");
}

/** Lee una respuesta JSON del cliente RPC y lanza `ApiClientError` si falla. */
export function readApiJson<T>(
  response: ApiResponseLike | Promise<ApiResponseLike>,
): Promise<T> {
  return Promise.resolve(response).then(async (resolved) => {
    if (!resolved.ok) throw await toApiClientError(resolved);
    return (await resolved.json()) as T;
  });
}

/** Comprueba una respuesta sin cuerpo (204) y lanza `ApiClientError` si falla. */
export function readApiVoid(
  response: ApiResponseLike | Promise<ApiResponseLike>,
): Promise<void> {
  return Promise.resolve(response).then(async (resolved) => {
    if (!resolved.ok) throw await toApiClientError(resolved);
  });
}

async function requestJson<T>(
  api: ApiClient,
  path: string,
  options: { method: string; context?: ApiContext; body?: unknown },
): Promise<ApiCallResult<T>> {
  const response = await api.fetch(`${api.baseUrl}${path}`, {
    method: options.method,
    headers: jsonHeaders(options.context ?? {}),
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });
  const setCookies = apiSetCookies(response);
  if (!response.ok) throw await toApiClientError(response);
  if (response.status === 204) return { data: undefined as T, setCookies };
  return { data: (await response.json()) as T, setCookies };
}

async function requestForm<T>(
  api: ApiClient,
  path: string,
  context: ApiContext,
  form: FormData,
): Promise<T> {
  const response = await api.fetch(`${api.baseUrl}${path}`, {
    method: "POST",
    headers: apiHeaders(context),
    body: form,
  });
  if (!response.ok) throw await toApiClientError(response);
  return (await response.json()) as T;
}

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

// ---------------------------------------------------------------------------
// Auth tienda
// ---------------------------------------------------------------------------

export async function checkStoreSlug(api: ApiClient, slug: string): Promise<SlugCheckResponse> {
  const result = await requestJson<SlugCheckResponse>(
    api,
    `/auth/store/slug-check${queryString({ slug })}`,
    { method: "GET" },
  );
  return result.data;
}

export async function signupStoreOtp(
  api: ApiClient,
  input: SignupOtpInput,
  context: ApiContext = {},
): Promise<{ ok: boolean; resendAfterSeconds: number; expiresInMinutes: number }> {
  const result = await requestJson<{
    ok: boolean;
    resendAfterSeconds: number;
    expiresInMinutes: number;
  }>(api, "/auth/store/signup/otp", { method: "POST", context, body: input });
  return result.data;
}

export async function signupStore(
  api: ApiClient,
  input: SignupInput,
  context: ApiContext = {},
): Promise<SignupResponse> {
  const result = await requestJson<SignupResponse>(api, "/auth/store/signup", {
    method: "POST",
    context,
    body: input,
  });
  return result.data;
}

export async function loginStore(
  api: ApiClient,
  input: StoreLoginInput,
  context: ApiContext & { storeSlug: string },
): Promise<ApiCallResult<StoreSessionResponse>> {
  return requestJson<StoreSessionResponse>(api, "/auth/store/login", {
    method: "POST",
    context,
    body: input,
  });
}

export async function readStoreSession(
  api: ApiClient,
  context: ApiContext & { storeSlug: string },
): Promise<ApiCallResult<StoreSessionResponse>> {
  return requestJson<StoreSessionResponse>(api, "/auth/store/session", {
    method: "GET",
    context,
  });
}

export async function logoutStore(
  api: ApiClient,
  context: ApiContext,
): Promise<{ setCookies: string[] }> {
  const result = await requestJson<undefined>(api, "/auth/store/logout", {
    method: "POST",
    context,
    body: {},
  });
  return { setCookies: result.setCookies };
}

export async function forgotStorePassword(
  api: ApiClient,
  input: ForgotPasswordInput,
  context: ApiContext = {},
): Promise<void> {
  await requestJson<{ ok: boolean }>(api, "/auth/store/password/forgot", {
    method: "POST",
    context,
    body: input,
  });
}

export async function resetStorePassword(
  api: ApiClient,
  input: ResetPasswordInput,
  context: ApiContext = {},
): Promise<void> {
  await requestJson<undefined>(api, "/auth/store/password/reset", {
    method: "POST",
    context,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Auth console
// ---------------------------------------------------------------------------

export async function getConsoleInitStatus(api: ApiClient): Promise<{ available: boolean }> {
  const result = await requestJson<{ available: boolean }>(api, "/auth/console/init-status", {
    method: "GET",
  });
  return result.data;
}

export async function initConsole(
  api: ApiClient,
  input: ConsoleInitInput,
  context: ApiContext = {},
): Promise<ConsoleInitResponse> {
  // M1: `/init` no abre sesión ni emite cookies; el acceso llega solo en
  // `/2fa/verify`. Por eso se devuelve el payload, sin envoltorio de cookies.
  const result = await requestJson<ConsoleInitResponse>(api, "/auth/console/init", {
    method: "POST",
    context,
    body: input,
  });
  return result.data;
}

/** Payload de `loginConsole` + cookies del challenge (`two_factor`), si aplica. */
export interface ConsoleLoginResult extends ConsoleLoginResponse {
  /** Solo trae `console.two_factor` cuando el login pide el segundo factor. */
  setCookies: string[];
}

export async function loginConsole(
  api: ApiClient,
  input: ConsoleLoginInput,
  context: ApiContext = {},
): Promise<ConsoleLoginResult> {
  const result = await requestJson<ConsoleLoginResponse>(api, "/auth/console/login", {
    method: "POST",
    context,
    body: input,
  });
  return { ...result.data, setCookies: result.setCookies };
}

export async function verifyConsoleTwoFactor(
  api: ApiClient,
  input: TwoFactorVerifyInput,
  context: ApiContext,
): Promise<{ setCookies: string[] }> {
  const result = await requestJson<undefined>(api, "/auth/console/2fa/verify", {
    method: "POST",
    context,
    body: input,
  });
  return { setCookies: result.setCookies };
}

/** Payload de `setupConsoleTwoFactor` + cookies (M1: hoy siempre vacío). */
export interface ConsoleTwoFactorSetupResult extends TwoFactorSetupResponse {
  setCookies: string[];
}

export async function setupConsoleTwoFactor(
  api: ApiClient,
  input: TwoFactorSetupInput,
  context: ApiContext,
): Promise<ConsoleTwoFactorSetupResult> {
  const result = await requestJson<TwoFactorSetupResponse>(api, "/auth/console/2fa/setup", {
    method: "POST",
    context,
    body: input,
  });
  return { ...result.data, setCookies: result.setCookies };
}

export async function readConsoleSession(
  api: ApiClient,
  context: ApiContext,
): Promise<ApiCallResult<AdminSessionResponse>> {
  return requestJson<AdminSessionResponse>(api, "/auth/console/session", {
    method: "GET",
    context,
  });
}

export async function logoutConsole(
  api: ApiClient,
  context: ApiContext,
): Promise<{ setCookies: string[] }> {
  const result = await requestJson<undefined>(api, "/auth/console/logout", {
    method: "POST",
    context,
    body: {},
  });
  return { setCookies: result.setCookies };
}

export async function forgotConsolePassword(
  api: ApiClient,
  input: ForgotPasswordInput,
  context: ApiContext = {},
): Promise<void> {
  await requestJson<{ ok: boolean }>(api, "/auth/console/password/forgot", {
    method: "POST",
    context,
    body: input,
  });
}

export async function resetConsolePassword(
  api: ApiClient,
  input: ResetPasswordInput,
  context: ApiContext = {},
): Promise<void> {
  await requestJson<undefined>(api, "/auth/console/password/reset", {
    method: "POST",
    context,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Público (storefront)
// ---------------------------------------------------------------------------

export function getPublicStore(api: ApiClient, slug: string): Promise<PublicStore> {
  return readApiJson<PublicStore>(api.client.public[":slug"].store.$get({ param: { slug } }));
}

export function getPublicHero(api: ApiClient, slug: string): Promise<PublicHero> {
  return readApiJson<PublicHero>(api.client.public[":slug"].hero.$get({ param: { slug } }));
}

export async function listPublicProducts(
  api: ApiClient,
  slug: string,
  query: Partial<PublicProductsQuery> = {},
): Promise<PublicProductList> {
  const result = await requestJson<PublicProductList>(
    api,
    `/public/${encodeURIComponent(slug)}/products${queryString({
      category: query.category,
      q: query.q,
      page: query.page,
    })}`,
    { method: "GET" },
  );
  return result.data;
}

export function getPublicProduct(
  api: ApiClient,
  slug: string,
  productSlug: string,
): Promise<PublicProductDetail> {
  return readApiJson<PublicProductDetail>(
    api.client.public[":slug"].products[":productSlug"].$get({
      param: { slug, productSlug },
    }),
  );
}

export function getPublicSitemap(api: ApiClient, slug: string): Promise<PublicSitemap> {
  return readApiJson<PublicSitemap>(api.client.public[":slug"].sitemap.$get({ param: { slug } }));
}

export function listPublicCategories(api: ApiClient, slug: string): Promise<PublicCategoryList> {
  return readApiJson<PublicCategoryList>(
    api.client.public[":slug"].categories.$get({ param: { slug } }),
  );
}

// ---------------------------------------------------------------------------
// Panel del dueño — tienda
// ---------------------------------------------------------------------------

export function getPanelStore(api: ApiClient, context: ApiContext): Promise<PanelStore> {
  return readApiJson<PanelStore>(
    api.client.panel.store.$get(undefined, { headers: apiHeaders(context) }),
  );
}

export function updatePanelStore(
  api: ApiClient,
  context: ApiContext,
  input: PanelStoreUpdateInput,
): Promise<PanelStore> {
  return readApiJson<PanelStore>(
    api.client.panel.store.$patch(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function uploadStoreLogo(
  api: ApiClient,
  context: ApiContext,
  form: FormData,
): Promise<PanelStoreLogoResponse> {
  return requestForm<PanelStoreLogoResponse>(api, "/panel/store/logo", context, form);
}

export function deleteStoreLogo(api: ApiClient, context: ApiContext): Promise<PanelStore> {
  return readApiJson<PanelStore>(
    api.client.panel.store.logo.$delete(undefined, { headers: apiHeaders(context) }),
  );
}

export function suspendPanelStore(
  api: ApiClient,
  context: ApiContext,
  input: PanelSuspendStoreInput,
): Promise<PanelStore> {
  return readApiJson<PanelStore>(
    api.client.panel.store.suspend.$post(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function reactivatePanelStore(api: ApiClient, context: ApiContext): Promise<PanelStore> {
  return readApiJson<PanelStore>(
    api.client.panel.store.reactivate.$post(undefined, { headers: apiHeaders(context) }),
  );
}

export async function deletePanelStore(
  api: ApiClient,
  context: ApiContext,
  input: PanelDeleteStoreInput,
): Promise<void> {
  await readApiVoid(
    api.client.panel.store.$delete(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

// ---------------------------------------------------------------------------
// Panel del dueño — productos
// ---------------------------------------------------------------------------

export async function listPanelProducts(
  api: ApiClient,
  context: ApiContext,
  query: Partial<PanelProductsQuery> = {},
): Promise<PanelProductList> {
  const result = await requestJson<PanelProductList>(
    api,
    `/panel/products${queryString({
      q: query.q,
      category: query.category,
      status: query.status,
      page: query.page,
    })}`,
    { method: "GET", context },
  );
  return result.data;
}

export function createPanelProduct(
  api: ApiClient,
  context: ApiContext,
  input: ProductCreateInput,
): Promise<PanelProduct> {
  return readApiJson<PanelProduct>(
    api.client.panel.products.$post(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function getPanelProduct(
  api: ApiClient,
  context: ApiContext,
  productId: string,
): Promise<PanelProduct> {
  return readApiJson<PanelProduct>(
    api.client.panel.products[":id"].$get(
      { param: { id: productId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export function updatePanelProduct(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  input: ProductUpdateInput,
): Promise<PanelProduct> {
  return readApiJson<PanelProduct>(
    api.client.panel.products[":id"].$patch(
      { param: { id: productId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function deletePanelProduct(
  api: ApiClient,
  context: ApiContext,
  productId: string,
): Promise<void> {
  await readApiVoid(
    api.client.panel.products[":id"].$delete(
      { param: { id: productId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export function setPanelProductStatus(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  input: ProductStatusInput,
): Promise<PanelProduct> {
  return readApiJson<PanelProduct>(
    api.client.panel.products[":id"].status.$patch(
      { param: { id: productId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function reorderPanelProducts(
  api: ApiClient,
  context: ApiContext,
  input: ReorderInput,
): Promise<void> {
  await readApiVoid(
    api.client.panel.products.reorder.$patch(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function uploadPanelProductImage(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  form: FormData,
): Promise<MediaImage> {
  return requestForm<MediaImage>(
    api,
    `/panel/products/${encodeURIComponent(productId)}/images`,
    context,
    form,
  );
}

export function updatePanelProductImage(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  imageId: string,
  input: ProductImageUpdateInput,
): Promise<MediaImage> {
  return readApiJson<MediaImage>(
    api.client.panel.products[":id"].images[":imageId"].$patch(
      { param: { id: productId, imageId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function deletePanelProductImage(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  imageId: string,
): Promise<void> {
  await readApiVoid(
    api.client.panel.products[":id"].images[":imageId"].$delete(
      { param: { id: productId, imageId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export function reorderPanelProductImages(
  api: ApiClient,
  context: ApiContext,
  productId: string,
  input: ProductImageOrderInput,
): Promise<PanelProduct> {
  return readApiJson<PanelProduct>(
    api.client.panel.products[":id"].images.order.$patch(
      { param: { id: productId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

// ---------------------------------------------------------------------------
// Panel del dueño — categorías y hero
// ---------------------------------------------------------------------------

export function listPanelCategories(
  api: ApiClient,
  context: ApiContext,
): Promise<PanelCategoryList> {
  return readApiJson<PanelCategoryList>(
    api.client.panel.categories.$get(undefined, { headers: apiHeaders(context) }),
  );
}

export function createPanelCategory(
  api: ApiClient,
  context: ApiContext,
  input: CategoryCreateInput,
): Promise<PanelCategory> {
  return readApiJson<PanelCategory>(
    api.client.panel.categories.$post(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function updatePanelCategory(
  api: ApiClient,
  context: ApiContext,
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<PanelCategory> {
  return readApiJson<PanelCategory>(
    api.client.panel.categories[":id"].$patch(
      { param: { id: categoryId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function deletePanelCategory(
  api: ApiClient,
  context: ApiContext,
  categoryId: string,
): Promise<void> {
  await readApiVoid(
    api.client.panel.categories[":id"].$delete(
      { param: { id: categoryId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export async function reorderPanelCategories(
  api: ApiClient,
  context: ApiContext,
  input: ReorderInput,
): Promise<void> {
  await readApiVoid(
    api.client.panel.categories.reorder.$patch(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function listPanelHero(api: ApiClient, context: ApiContext): Promise<PanelHeroList> {
  return readApiJson<PanelHeroList>(
    api.client.panel.hero.$get(undefined, { headers: apiHeaders(context) }),
  );
}

export function createPanelHero(
  api: ApiClient,
  context: ApiContext,
  form: FormData,
): Promise<PanelHeroSlide> {
  return requestForm<PanelHeroSlide>(api, "/panel/hero", context, form);
}

export function updatePanelHero(
  api: ApiClient,
  context: ApiContext,
  slideId: string,
  input: HeroUpdateInput,
): Promise<PanelHeroSlide> {
  return readApiJson<PanelHeroSlide>(
    api.client.panel.hero[":id"].$patch(
      { param: { id: slideId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function deletePanelHero(
  api: ApiClient,
  context: ApiContext,
  slideId: string,
): Promise<void> {
  await readApiVoid(
    api.client.panel.hero[":id"].$delete(
      { param: { id: slideId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export function reorderPanelHero(
  api: ApiClient,
  context: ApiContext,
  input: HeroReorderInput,
): Promise<PanelHeroList> {
  return readApiJson<PanelHeroList>(
    api.client.panel.hero.reorder.$patch(undefined, {
      headers: jsonHeaders(context),
      init: { body: JSON.stringify(input) },
    }),
  );
}

export function replacePanelHeroImages(
  api: ApiClient,
  context: ApiContext,
  slideId: string,
  form: FormData,
): Promise<PanelHeroSlide> {
  return requestForm<PanelHeroSlide>(
    api,
    `/panel/hero/${encodeURIComponent(slideId)}/images`,
    context,
    form,
  );
}

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

export async function listConsoleStores(
  api: ApiClient,
  context: ApiContext,
  query: Partial<ConsoleStoresQuery> = {},
): Promise<ConsoleStoreList> {
  const result = await requestJson<ConsoleStoreList>(
    api,
    `/console/stores${queryString({
      q: query.q,
      status: query.status,
      page: query.page,
    })}`,
    { method: "GET", context },
  );
  return result.data;
}

export function getConsoleStore(
  api: ApiClient,
  context: ApiContext,
  storeId: string,
): Promise<ConsoleStoreDetail> {
  return readApiJson<ConsoleStoreDetail>(
    api.client.console.stores[":id"].$get(
      { param: { id: storeId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export function suspendConsoleStore(
  api: ApiClient,
  context: ApiContext,
  storeId: string,
  input: ConsoleSuspendStoreInput,
): Promise<ConsoleStoreDetail> {
  return readApiJson<ConsoleStoreDetail>(
    api.client.console.stores[":id"].suspend.$post(
      { param: { id: storeId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export function reactivateConsoleStore(
  api: ApiClient,
  context: ApiContext,
  storeId: string,
): Promise<ConsoleStoreDetail> {
  return readApiJson<ConsoleStoreDetail>(
    api.client.console.stores[":id"].reactivate.$post(
      { param: { id: storeId } },
      { headers: apiHeaders(context) },
    ),
  );
}

export async function deleteConsoleStore(
  api: ApiClient,
  context: ApiContext,
  storeId: string,
  input: ConsoleDeleteStoreInput,
): Promise<void> {
  await readApiVoid(
    api.client.console.stores[":id"].$delete(
      { param: { id: storeId } },
      { headers: jsonHeaders(context), init: { body: JSON.stringify(input) } },
    ),
  );
}

export async function listConsoleAudit(
  api: ApiClient,
  context: ApiContext,
  query: { storeId?: string; action?: string; page?: number } = {},
): Promise<ConsoleAuditList> {
  const result = await requestJson<ConsoleAuditList>(
    api,
    `/console/audit${queryString({
      storeId: query.storeId,
      action: query.action,
      page: query.page,
    })}`,
    { method: "GET", context },
  );
  return result.data;
}
