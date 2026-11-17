import type { RouterContextProvider } from "react-router";

import { type CommercialEnv, envContext } from "~/context";

/** Variables del worker commercial (sin defaults: si falta algo, falla visible). */
export function getEnv(context: Readonly<RouterContextProvider>): CommercialEnv {
  return context.get(envContext);
}

/** `TURNSTILE_SITE_KEY` es obligatoria en `/registro`: sin widget no hay OTP. */
export function requireTurnstileSiteKey(env: CommercialEnv): string {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  if (!siteKey) {
    console.error(
      JSON.stringify({
        level: "error",
        app: "commercial",
        message: "Falta TURNSTILE_SITE_KEY; el registro no puede emitir OTP",
      }),
    );
    throw new Response("El registro no está disponible ahora mismo.", {
      status: 503,
      statusText: "SERVICE_UNAVAILABLE",
    });
  }
  return siteKey;
}
