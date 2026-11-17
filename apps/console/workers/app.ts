import { withSecurityHeaders } from "@tucatalogo/shared/security-headers";
import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const response = await requestHandler(request);

    return withSecurityHeaders(response, {
      surface: "console",
      environment: env.ENVIRONMENT,
    });
  },
} satisfies ExportedHandler<Env>;
