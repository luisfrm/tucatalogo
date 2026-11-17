import {
  ApiClientError,
  ApiTransportError,
  getPanelStore,
  readStoreSession,
} from "@tucatalogo/api-client";
import type { PanelStore, StoreSessionResponse } from "@tucatalogo/types";
import { data, redirect } from "react-router";

import { panelHref } from "./urls";
import {
  createRequestRuntime,
  fail,
  resolveStoreRequest,
  throwApiFailure,
  type RequestRuntime,
} from "./runtime.server";
import { safePanelRedirect } from "./panel";

/**
 * Contexto de `/panel-admin` (F5).
 *
 * La tienda se resuelve **solo** del `Host` (o `?siteId` en dev/local) y la
 * sesión se lee en servidor. Nunca se acepta `storeId` del formulario: el API
 * vuelve a comprobar que la sesión pertenece al dueño de esa tienda.
 */
export interface PanelContext {
  runtime: RequestRuntime;
  slug: string;
  siteId: string | null;
  session: StoreSessionResponse;
  store: PanelStore;
  cookie: string | undefined;
}

export interface PanelApiContext {
  storeSlug: string;
  cookie: string | undefined;
  clientIp: string | undefined;
}

function requestCookie(request: Request): string | undefined {
  return request.headers.get("cookie") ?? undefined;
}

function requestIp(request: Request): string | undefined {
  return request.headers.get("cf-connecting-ip") ?? undefined;
}

export function panelApiContext(
  request: Request,
  slug: string,
): PanelApiContext {
  return {
    storeSlug: slug,
    cookie: requestCookie(request),
    clientIp: requestIp(request),
  };
}

/** URL de login con `redirectTo` interno y `?siteId` de dev/local. */
export function loginRedirect(request: Request, siteId: string | null): never {
  const url = new URL(request.url);
  const target = `${url.pathname}${url.search}`;
  throw redirect(
    panelHref("login", { siteId, query: { redirectTo: target } }),
  );
}

/**
 * Sesión + ficha de tienda para una ruta protegida. Sin sesión → redirect al
 * login; sesión de otro reino/tienda → 403; fallo del API → 5xx con log.
 */
export async function requirePanelContext(request: Request): Promise<PanelContext> {
  const resolved = resolveStoreRequest(request, createRequestRuntime(request));
  const context = panelApiContext(request, resolved.slug);

  let session: StoreSessionResponse;
  try {
    const result = await readStoreSession(resolved.runtime.api, context);
    session = result.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      loginRedirect(request, resolved.siteId);
    }
    if (error instanceof ApiClientError && error.status === 403) {
      throw data(
        {
          message: "Esta sesión no pertenece al dueño de la tienda.",
          requestId: resolved.runtime.requestId,
        },
        { status: 403, statusText: "Forbidden" },
      );
    }
    throwApiFailure(resolved.runtime, error, "panel.session_failed");
  }

  let store: PanelStore;
  try {
    store = await getPanelStore(resolved.runtime.api, context);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      loginRedirect(request, resolved.siteId);
    }
    throwApiFailure(resolved.runtime, error, "panel.store_failed");
  }

  return {
    runtime: resolved.runtime,
    slug: resolved.slug,
    siteId: resolved.siteId,
    session,
    store,
    cookie: context.cookie,
  };
}

/**
 * `true` cuando ya hay una sesión válida para esta tienda. Se usa en el login
 * para no mostrar el formulario a quien ya entró. Cualquier otro fallo no se
 * oculta: se propaga como 5xx.
 */
export async function hasPanelSession(request: Request): Promise<boolean> {
  const resolved = resolveStoreRequest(request, createRequestRuntime(request));
  try {
    await readStoreSession(resolved.runtime.api, panelApiContext(request, resolved.slug));
    return true;
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    throwApiFailure(resolved.runtime, error, "panel.session_check_failed");
  }
}

export interface PanelActionError {
  formError: string;
  fieldErrors: Record<string, string>;
  status: number;
}

const FALLBACK_ACTION_ERROR = "No pudimos guardar los cambios. Inténtalo de nuevo.";

/** Traduce un error del API a mensajes de formulario (nunca 500 por validación). */
export function panelActionError(
  error: unknown,
  fallback = FALLBACK_ACTION_ERROR,
): PanelActionError {
  if (error instanceof ApiClientError) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of error.details ?? []) {
      if (!fieldErrors[detail.path]) fieldErrors[detail.path] = detail.message;
    }

    if (error.status === 429) {
      return {
        status: 429,
        fieldErrors,
        formError:
          "Demasiados intentos. Espera unos minutos antes de volver a probar.",
      };
    }
    if (error.status === 401) {
      return {
        status: 401,
        fieldErrors,
        formError: "Tu sesión caducó. Vuelve a iniciar sesión.",
      };
    }
    if (error.status === 403) {
      return {
        status: 403,
        fieldErrors,
        formError:
          error.reason === "STORE_SUSPENDED_BY_ADMIN"
            ? "La tienda fue suspendida por el equipo de TuCatálogo. No puedes reactivarla desde el panel."
            : "No tienes permiso para esta acción.",
      };
    }
    return { status: error.status, fieldErrors, formError: error.message || fallback };
  }

  if (error instanceof ApiTransportError || error instanceof Error) {
    // Fallo de configuración/transporte: visible y sin inventar éxito.
    return { status: 503, fieldErrors: {}, formError: fallback };
  }

  return { status: 500, fieldErrors: {}, formError: fallback };
}

/** Respuesta 303 que conserva cookies del API (login/logout). */
export function redirectWithCookies(target: string, setCookies: string[] = []): Response {
  const headers = new Headers({ location: target });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/** Redirección 303 a una URL interna ya construida. */
export function redirectTo(target: string): Response {
  return new Response(null, { status: 303, headers: { location: target } });
}

/** Destino del login tras autenticar: solo rutas internas de `/panel-admin`. */
export function panelLoginTarget(value: unknown, siteId: string | null): string {
  return safePanelRedirect(value, panelHref("", { siteId }));
}

/** Error de formulario tipado para `useActionData`. */
export function actionErrorResponse(
  error: PanelActionError,
  values: Record<string, string> = {},
): ReturnType<typeof data> {
  return data(
    {
      ok: false as const,
      formError: error.formError,
      fieldErrors: error.fieldErrors,
      values,
    },
    { status: error.status },
  );
}

/** Log de un fallo no recuperable sin exponer secretos del formulario. */
export function logPanelFailure(
  context: { runtime: RequestRuntime },
  event: string,
  error: unknown,
): void {
  fail(
    context.runtime.requestId,
    502,
    "El panel no está disponible en este momento.",
    event,
    {
      message: error instanceof Error ? error.message : String(error),
    },
  );
}
