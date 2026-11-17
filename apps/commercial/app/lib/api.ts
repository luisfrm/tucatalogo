import type { ApiClient } from "@tucatalogo/api-client";
import type { RouterContextProvider } from "react-router";

import { apiContext } from "~/context";

/**
 * Cliente del API para loaders/actions (PLAN §9.2).
 *
 * El navegador nunca llama al API: solo se usa en servidor. Si falta el service
 * binding y `API_INTERNAL_URL`, se responde 503 con log, jamás un cliente vacío.
 */
export function getApi(context: Readonly<RouterContextProvider>): ApiClient {
  try {
    return context.get(apiContext)();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        app: "commercial",
        message: "Sin transporte hacia el API",
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    throw new Response("El registro no está disponible ahora mismo.", {
      status: 503,
      statusText: "SERVICE_UNAVAILABLE",
    });
  }
}
