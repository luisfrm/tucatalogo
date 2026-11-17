import { withSecurityHeaders } from "@tucatalogo/shared/security-headers";
import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const PANEL_ADMIN_PATH = "/panel-admin";

/** También cubre las URLs de datos (`/panel-admin.data`, `/panel-admin/x.data`). */
function isPanelAdminPath(pathname: string): boolean {
  const path = pathname.endsWith(".data")
    ? pathname.slice(0, -".data".length)
    : pathname;

  return path === PANEL_ADMIN_PATH || path.startsWith(`${PANEL_ADMIN_PATH}/`);
}

export default {
  async fetch(request, env) {
    const response = await requestHandler(request);
    const { pathname } = new URL(request.url);

    return withSecurityHeaders(response, {
      surface: isPanelAdminPath(pathname) ? "panel-admin" : "storefront",
      environment: env.ENVIRONMENT,
    });
  },
} satisfies ExportedHandler<Env>;
