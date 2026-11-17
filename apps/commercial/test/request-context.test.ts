import { describe, expect, it } from "vitest";

import { apiContext, envContext, type CommercialEnv } from "~/context";
import { createRequestContext } from "~/lib/request-context.server";

/**
 * Regresión: el worker `commercial` debe inyectar el `env` y la fábrica del
 * cliente del API en el `RouterContextProvider`. Sin esto, `/registro`
 * respondía 500 ("No value found for context") y el registro era inalcanzable.
 */

function fakeEnv(overrides: Partial<CommercialEnv> = {}): Env {
  return {
    ENVIRONMENT: "local",
    APP_DOMAIN: "localhost",
    API_INTERNAL_URL: "http://127.0.0.1:9797",
    MEDIA_BASE_URL: "http://127.0.0.1:9797/media",
    TURNSTILE_MODE: "test",
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    ...overrides,
  } as unknown as Env;
}

describe("createRequestContext", () => {
  it("inyecta el env del worker para los loaders", () => {
    const env = fakeEnv();
    const context = createRequestContext(env);
    expect(context.get(envContext)).toBe(env);
  });

  it("expone una fábrica del cliente del API con transporte local", () => {
    const context = createRequestContext(fakeEnv());
    const api = context.get(apiContext)();
    expect(api).toBeTypeOf("object");
  });

  it("sin binding ni API_INTERNAL_URL el cliente falla en vez de quedar vacío", () => {
    const context = createRequestContext(fakeEnv({ API_INTERNAL_URL: undefined, API: undefined }));
    expect(() => context.get(apiContext)()).toThrow();
  });
});
