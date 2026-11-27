import { env } from "cloudflare:workers";
import {
  ApiClientError,
  ApiTransportError,
  createApiClient,
  getPanelStore,
  getPublicStore,
  readStoreSession,
  type ApiClient,
} from "@tucatalogo/api-client";
import type { PanelStore, PublicStore } from "@tucatalogo/types";
import { data } from "react-router";

import {
  allowsSiteId,
  isPanelAdminPath,
  resolveStoreSlug,
} from "./host";
import { logError, logWarn, type LogFields } from "./log";
import {
  isAppEnvironment,
  type AppEnvironment,
  type RootData,
  type SiteSurface,
} from "./store-context";

/**
 * Acceso a configuración y datos del API desde el servidor (PLAN §4.5 D / §9.2).
 *
 * - La tienda se resuelve **siempre** aquí, desde el `Host` (o `?siteId` en
 *   local/development). Nunca se acepta un `storeId` del navegador.
 * - El navegador nunca llama al API: este módulo solo se importa desde
 *   loaders/actions/resource routes (`*.server.ts`).
 * - Sin fallbacks: falta de configuración → 503 + log; error del API → 502;
 *   tienda inexistente/suspendida/eliminada → 404 idéntico.
 */
export interface RequestRuntime {
  requestId: string;
  environment: AppEnvironment;
  appDomain: string;
  isProduction: boolean;
  allowSiteId: boolean;
  noindex: boolean;
  /** `true` cuando la cookie debe llevar `Secure`. */
  secure: boolean;
  api: ApiClient;
}

export function createRequestRuntime(request: Request): RequestRuntime {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);

  const rawEnvironment = env.ENVIRONMENT;
  if (!isAppEnvironment(rawEnvironment)) {
    fail(requestId, 503, "La configuración del storefront está incompleta.", "config.invalid_environment", {
      value: rawEnvironment ?? null,
    });
  }

  const appDomain = env.APP_DOMAIN?.trim();
  if (!appDomain) {
    fail(requestId, 503, "La configuración del storefront está incompleta.", "config.missing_app_domain");
  }

  let api: ApiClient;
  try {
    api = createApiClient({
      API: env.API,
      API_INTERNAL_URL: env.API_INTERNAL_URL,
    });
  } catch (error) {
    fail(requestId, 503, "El catálogo no está disponible en este momento.", "api.missing_transport", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const isProduction = rawEnvironment === "production";

  return {
    requestId,
    environment: rawEnvironment,
    appDomain,
    isProduction,
    allowSiteId: allowsSiteId(rawEnvironment),
    noindex: !isProduction,
    secure: isProduction || url.protocol === "https:",
    api,
  };
}

export interface StoreRequest {
  slug: string;
  siteId: string | null;
  surface: SiteSurface;
  runtime: RequestRuntime;
}

/** Resuelve slug + superficie y traduce los rechazos a 400/404. */
export function resolveStoreRequest(request: Request, runtime: RequestRuntime): StoreRequest {
  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId");
  const resolution = resolveStoreSlug(url.hostname, runtime.appDomain, {
    siteId,
    allowSiteId: runtime.allowSiteId,
  });
  const surface: SiteSurface = isPanelAdminPath(url.pathname) ? "panel-admin" : "storefront";

  if (resolution.reason === "site-id-forbidden") {
    fail(
      runtime.requestId,
      400,
      "El parámetro siteId no está permitido en este entorno.",
      "host.site_id_forbidden",
      { host: url.hostname },
    );
  }

  if (resolution.reason === "site-id-invalid") {
    fail(runtime.requestId, 400, "El identificador de tienda no es válido.", "host.site_id_invalid", {
      siteId: resolution.siteId,
    });
  }

  if ((resolution.reason === "ok" || resolution.reason === "site-id") && resolution.slug) {
    return {
      slug: resolution.slug,
      siteId: resolution.siteId,
      surface,
      runtime,
    };
  }

  // Ápice, www, reservados, hosts ajenos o slug con formato inválido: 404 sin
  // revelar nada más. En prod el ápice lo corta antes la Redirect Rule.
  logWarn("host.store_not_resolved", {
    requestId: runtime.requestId,
    host: url.hostname,
    reason: resolution.reason,
  });
  throw notFound();
}

/** Atajo para loaders de ruta que solo necesitan el slug resuelto. */
export function resolveStoreQuery(request: Request): StoreRequest {
  return resolveStoreRequest(request, createRequestRuntime(request));
}

/**
 * `GET /public/:slug/store`. Devuelve `null` solo cuando el API responde 404
 * (tienda inexistente, suspendida o eliminada); el resto de fallos son 5xx.
 */
export async function fetchPublicStoreOrNull(
  runtime: RequestRuntime,
  slug: string,
): Promise<PublicStore | null> {
  try {
    return await getPublicStore(runtime.api, slug);
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 404) return null;
      fail(runtime.requestId, 502, "El catálogo no está disponible en este momento.", "api.store_error", {
        status: error.status,
        code: error.code,
        reason: error.reason ?? null,
        apiRequestId: error.requestId ?? null,
      });
    }
    if (error instanceof ApiTransportError) {
      fail(runtime.requestId, 503, "El catálogo no está disponible en este momento.", "api.transport_error", {
        message: error.message,
      });
    }
    fail(runtime.requestId, 502, "El catálogo no está disponible en este momento.", "api.unexpected_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Error tipado que la app puede mostrar al usuario, siempre en español. */
export interface AppErrorPayload {
  message: string;
  requestId?: string;
}

/**
 * Ficha del panel para el `<head>` del root cuando el storefront público da
 * 404 (tienda suspendida o eliminada). Solo devuelve datos con una sesión de
 * tienda válida; 401/403/404 se tratan como "sin sesión" y el panel pinta su
 * base neutra. Un fallo de configuración o del API sí es 5xx (sin fallback).
 */
export async function fetchPanelStoreForRoot(
  runtime: RequestRuntime,
  slug: string,
  cookie: string | undefined,
): Promise<PanelStore | null> {
  try {
    await readStoreSession(runtime.api, { storeSlug: slug, cookie });
    return await getPanelStore(runtime.api, { storeSlug: slug, cookie });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401 || error.status === 403 || error.status === 404) return null;
      fail(runtime.requestId, 502, "El panel no está disponible en este momento.", "panel.store_error", {
        status: error.status,
        code: error.code,
        reason: error.reason ?? null,
        apiRequestId: error.requestId ?? null,
      });
    }
    if (error instanceof ApiTransportError) {
      fail(runtime.requestId, 503, "El panel no está disponible en este momento.", "panel.transport_error", {
        message: error.message,
      });
    }
    fail(runtime.requestId, 502, "El panel no está disponible en este momento.", "panel.unexpected_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function notFound(): never {
  throw data<AppErrorPayload>(
    { message: "La página que buscas no existe." },
    { status: 404, statusText: "Not Found" },
  );
}

/**
 * Traduce un fallo del API en la respuesta correcta para el navegador:
 * 404 → boundary 404, transporte ausente → 503, resto → 502. Siempre con log.
 */
export function throwApiFailure(
  runtime: RequestRuntime,
  error: unknown,
  event: string,
  fields: LogFields = {},
): never {
  if (error instanceof ApiClientError) {
    if (error.status === 404) throw notFound();
    fail(runtime.requestId, 502, "El catálogo no está disponible en este momento.", event, {
      status: error.status,
      code: error.code,
      reason: error.reason ?? null,
      apiRequestId: error.requestId ?? null,
      ...fields,
    });
  }

  if (error instanceof ApiTransportError) {
    fail(runtime.requestId, 503, "El catálogo no está disponible en este momento.", event, {
      message: error.message,
      ...fields,
    });
  }

  fail(runtime.requestId, 502, "El catálogo no está disponible en este momento.", event, {
    message: error instanceof Error ? error.message : String(error),
    ...fields,
  });
}

/**
 * Categoría inexistente en `?category=`: el API responde `404 CATEGORY_NOT_FOUND`
 * (`apps/api/src/routes/README.md`). Se muestra un estado vacío, no un 404 de
 * página, para no romper la navegación del catálogo.
 */
export function isCategoryNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404 && error.reason === "CATEGORY_NOT_FOUND";
}

/**
 * Datos mínimos para `/health`: no resuelve tienda ni tema porque el smoke del
 * worker debe responder aunque no exista el host de una tienda (§13.6).
 */
export function healthRootData(request: Request): RootData {
  const raw = env.ENVIRONMENT;
  const environment: AppEnvironment = isAppEnvironment(raw) ? raw : "local";

  return {
    requestId: crypto.randomUUID(),
    environment,
    noindex: environment !== "production",
    surface: "storefront",
    siteId: null,
    store: null,
    categories: [],
    mode: "light",
    theme: null,
    adminCss: null,
    canonicalBase: new URL(request.url).origin,
  };
}

/**
 * Fallo con log estructurado. El `requestId` viaja en el payload para que el
 * boundary de 500 lo muestre (PLAN §9.5).
 */
export function fail(
  requestId: string,
  status: number,
  message: string,
  event: string,
  fields: LogFields = {},
): never {
  logError(event, { requestId, status, ...fields });
  throw data<AppErrorPayload>(
    { message, requestId },
    { status, statusText: status >= 500 ? "Error" : "Error de la solicitud" },
  );
}
