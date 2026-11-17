import { hc } from "hono/client";
import type { AppType } from "@tucatalogo/api/app-type";

import { createApiTransport, type ApiTransport, type ApiTransportOptions } from "./transport";

/** Cliente Hono RPC tipado contra el `AppType` completo del API. */
export type HonoRpcClient = ReturnType<typeof hc<AppType>>;

export interface ApiClient extends ApiTransport {
  client: HonoRpcClient;
}

/**
 * Cliente del API para loaders/actions/resource routes (PLAN §9.2).
 *
 * Expone el cliente RPC (tipos de entrada/salida) y el `fetch` del transporte,
 * que es lo que usan las subidas multipart y las lecturas con query string.
 * El navegador nunca llama al API: esto solo corre en el servidor.
 */
export function createApiClient(options: ApiTransportOptions): ApiClient {
  const transport = createApiTransport(options);
  return {
    ...transport,
    client: hc<AppType>(transport.baseUrl, { fetch: transport.fetch }),
  };
}
