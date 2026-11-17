/**
 * Adapter de transporte del API (PLAN §9.2).
 *
 * - dev/prod: `env.API.fetch(request)` (service binding del worker actual).
 * - local: `http://127.0.0.1:9797` desde `API_INTERNAL_URL`.
 *
 * Si no hay binding ni URL: error explícito (503). Nunca un cliente vacío.
 */

/** Subconjunto del `Fetcher` de Workers que usa el adapter. */
export interface ApiServiceBinding {
  fetch(request: Request): Promise<Response>;
}

export interface ApiTransportOptions {
  /** Service binding `API` (solo dev/prod). */
  API?: ApiServiceBinding;
  /** Solo local: URL del `wrangler dev` del api. */
  API_INTERNAL_URL?: string;
}

export interface ApiTransport {
  baseUrl: string;
  fetch: typeof fetch;
}

/** Base URL ficticia: el service binding ignora el host y enruta al worker. */
export const SERVICE_BINDING_BASE_URL = "http://api.internal";

export class ApiTransportError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "ApiTransportError";
  }
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? new Request(input, init) : new Request(input, init);
}

export function createApiTransport(options: ApiTransportOptions): ApiTransport {
  if (options.API) {
    const binding = options.API;
    const bindingFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      binding.fetch(toRequest(input, init))) as typeof fetch;

    return { baseUrl: SERVICE_BINDING_BASE_URL, fetch: bindingFetch };
  }

  const baseUrl = options.API_INTERNAL_URL?.trim();
  if (!baseUrl) {
    throw new ApiTransportError(
      "Falta el binding API o API_INTERNAL_URL: no hay transporte hacia el api.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    fetch: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
  };
}

/** Reenvía la cookie de entrada del navegador al API (loader/action). */
export function cookieHeadersFrom(request: Request): HeadersInit {
  const cookie = request.headers.get("cookie");
  return cookie ? { cookie } : {};
}
