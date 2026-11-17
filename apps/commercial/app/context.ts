import { createContext } from "react-router";

import type { ApiClient } from "@tucatalogo/api-client";

/**
 * Contrato entre el worker (`workers/app.ts`) y los loaders/actions.
 *
 * React Router v8 recibe el contexto como `RouterContextProvider`; el worker
 * inyecta el `env` del Worker y una **fábrica** del cliente del API. La fábrica
 * es perezosa a propósito: si falta el service binding o `API_INTERNAL_URL`, el
 * fallo aparece en la ruta que consume el API (503 + log), no en la landing.
 */
export interface CommercialEnv {
  ENVIRONMENT: string;
  APP_DOMAIN: string;
  API_INTERNAL_URL?: string;
  MEDIA_BASE_URL?: string;
  TURNSTILE_MODE?: string;
  TURNSTILE_SITE_KEY?: string;
  API?: { fetch(request: Request): Promise<Response> };
}

export type ApiClientFactory = () => ApiClient;

export const envContext = createContext<CommercialEnv>();
export const apiContext = createContext<ApiClientFactory>();
