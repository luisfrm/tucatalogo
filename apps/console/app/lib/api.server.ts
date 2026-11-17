import { env } from "cloudflare:workers";

import { createApiClient, type ApiClient, type ApiContext } from "@tucatalogo/api-client";

/**
 * Cliente del API para loaders/actions del console (PLAN §9.2).
 *
 * - dev/prod: service binding `API`.
 * - local: `API_INTERNAL_URL` (`http://127.0.0.1:9797`).
 *
 * El navegador nunca llama al API. Si no hay binding ni URL,
 * `createApiClient` lanza `ApiTransportError` (503), sin cliente vacío.
 */
export function getApi(): ApiClient {
  return createApiClient({
    API: env.API,
    API_INTERNAL_URL: env.API_INTERNAL_URL,
  });
}

/**
 * Contexto interno: cookie del navegador tal cual e IP real para rate limit.
 * El host es exacto (no hay `x-store-slug` en el reino console).
 *
 * **B10:** solo se acepta `cf-connecting-ip`, que Cloudflare fija en el borde.
 * `x-forwarded-for` lo puede escribir el cliente y no es una fuente de IP de
 * confianza; si no hay cabecera de Cloudflare, no se inventa una IP.
 */
export function apiContext(request: Request): ApiContext {
  return {
    cookie: request.headers.get("cookie") ?? undefined,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };
}
