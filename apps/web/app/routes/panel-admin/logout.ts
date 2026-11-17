import { ApiClientError, logoutStore } from "@tucatalogo/api-client";
import { redirect } from "react-router";

import type { Route } from "./+types/logout";

import { redirectWithCookies } from "~/lib/panel.server";
import { resolveStoreQuery, throwApiFailure } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

/**
 * Logout del reino tienda: invalida la sesión en D1 y reenvía las cookies de
 * borrado del API. Solo POST (nunca un GET destructivo).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { siteId } = resolveStoreQuery(request);
  return redirect(panelHref("", { siteId }));
}

export async function action({ request }: Route.ActionArgs) {
  const { runtime, siteId } = resolveStoreQuery(request);

  try {
    const result = await logoutStore(runtime.api, {
      cookie: request.headers.get("cookie") ?? undefined,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });
    return redirectWithCookies(
      panelHref("login", { siteId }),
      result.setCookies,
    );
  } catch (error) {
    // Sesión ya inválida: el resultado para el dueño es el mismo (login).
    if (error instanceof ApiClientError && error.status === 401) {
      return redirectWithCookies(panelHref("login", { siteId }));
    }
    throwApiFailure(runtime, error, "panel.logout_failed");
  }
}
