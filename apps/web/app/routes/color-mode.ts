import { data, redirect } from "react-router";

import type { Route } from "./+types/color-mode";

import { isColorMode, serializeColorModeCookie } from "~/lib/color-mode";
import { resolveStoreQuery } from "~/lib/runtime.server";
import { sanitizeRedirectTarget } from "~/lib/urls";

/**
 * Resource route del selector claro/oscuro (PLAN §10.7).
 * POST same-origin: valida el modo, persiste la cookie host-only y redirige a la
 * misma página. El HTML siguiente ya sale en el modo elegido.
 */
export async function loader() {
  return redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  const { runtime } = resolveStoreQuery(request);
  const form = await request.formData();
  const mode = form.get("color_mode");

  if (!isColorMode(mode)) {
    throw data(
      { message: "El modo de color no es válido." },
      { status: 400, statusText: "Bad Request" },
    );
  }

  return redirect(sanitizeRedirectTarget(form.get("redirectTo")), {
    status: 303,
    headers: {
      "set-cookie": serializeColorModeCookie(mode, { secure: runtime.secure }),
    },
  });
}
