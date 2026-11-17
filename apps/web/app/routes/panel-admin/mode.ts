import { data, redirect } from "react-router";

import type { Route } from "./+types/mode";

import { isColorMode, serializeColorModeCookie } from "~/lib/color-mode";
import { safePanelRedirect } from "~/lib/panel";
import { resolveStoreQuery } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

/**
 * Selector claro/oscuro **del panel**. Usa su propia cookie host-only
 * (`panel_color_mode`) para no tocar el modo del visitante del storefront.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { siteId } = resolveStoreQuery(request);
  return redirect(panelHref("", { siteId }));
}

export async function action({ request }: Route.ActionArgs) {
  const { runtime, siteId } = resolveStoreQuery(request);
  const form = await request.formData();
  const mode = form.get("color_mode");

  if (!isColorMode(mode)) {
    throw data(
      { message: "El modo de color no es válido." },
      { status: 400, statusText: "Bad Request" },
    );
  }

  const target = safePanelRedirect(form.get("redirectTo"), panelHref("", { siteId }));

  return redirect(target, {
    status: 303,
    headers: {
      "set-cookie": serializeColorModeCookie(mode, { secure: runtime.secure, panel: true }),
    },
  });
}
