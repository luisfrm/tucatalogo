import { env } from "cloudflare:workers";

/** Smoke de la app (PLAN §13.6). Falla visible si falta configuración. */
export function loader() {
  const missing = (["ENVIRONMENT", "APP_DOMAIN"] as const).filter(
    (name) => !env[name],
  );

  const ok = missing.length === 0;
  if (!ok) {
    console.error(
      JSON.stringify({
        level: "error",
        app: "console",
        message: "Faltan variables obligatorias",
        missing,
      }),
    );
  }

  return Response.json(
    {
      status: ok ? "ok" : "error",
      app: "console",
      checks: { env: ok ? "ok" : "error" },
      version: "0.0.0-f1",
    },
    { status: ok ? 200 : 503 },
  );
}
