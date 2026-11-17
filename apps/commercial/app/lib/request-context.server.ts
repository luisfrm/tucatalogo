import { createApiClient } from "@tucatalogo/api-client";
import { RouterContextProvider } from "react-router";

import { apiContext, envContext, type CommercialEnv } from "~/context";

/**
 * Contexto por request del worker `commercial` (PLAN §9.2).
 *
 * React Router v8 recibe el contexto como segundo argumento de
 * `createRequestHandler`; los loaders/actions lo leen con `context.get(...)`.
 * El `env` del Worker y la fábrica del cliente del API se inyectan aquí:
 * sin esto, `getEnv`/`getApi` lanzan "No value found for context" y el registro
 * responde 500 aunque la configuración exista.
 */
export function createRequestContext(env: Env): RouterContextProvider {
  const context = new RouterContextProvider();

  context.set(envContext, env as unknown as CommercialEnv);
  // Fábrica perezosa a propósito: si falta el binding y `API_INTERNAL_URL`, el
  // fallo aparece en la ruta que consume el API (503 + log), no en la landing.
  context.set(apiContext, () =>
    createApiClient({ API: env.API, API_INTERNAL_URL: env.API_INTERNAL_URL }),
  );

  return context;
}
