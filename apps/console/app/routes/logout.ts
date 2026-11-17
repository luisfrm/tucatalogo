import { logoutConsole } from "@tucatalogo/api-client";
import { redirect } from "react-router";

import { apiContext, getApi } from "../lib/api.server";
import { consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/logout";

/** Un GET a `/logout` no cierra sesión (PLAN §7.2): solo redirige. */
export function loader() {
  return redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }

  const api = getApi();
  const result = await logoutConsole(api, apiContext(request));

  return redirect("/login", { headers: consoleResponseHeaders(result.setCookies) });
}
