import { withSecurityHeaders } from "@tucatalogo/shared/security-headers";
import { createRequestHandler } from "react-router";

import { createRequestContext } from "../app/lib/request-context.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    // El contexto lleva el `env` del Worker y la fábrica del cliente del API:
    // los loaders/actions lo leen con `context.get(...)` (PLAN §9.2).
    const context = createRequestContext(env);
    const response = await requestHandler(request, context);

    return withSecurityHeaders(response, {
      surface: "commercial",
      environment: env.ENVIRONMENT,
    });
  },
} satisfies ExportedHandler<Env>;
