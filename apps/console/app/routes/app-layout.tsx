import { data, Outlet, useLoaderData } from "react-router";

import { AppShell } from "../components/app-shell";
import { apiContext, getApi } from "../lib/api.server";
import { consoleResponseHeaders } from "../lib/http.server";
import { requireConsoleSession } from "../lib/session.server";
import type { Route } from "./+types/app-layout";

/**
 * Guard común de las rutas autenticadas del console. Cada loader hijo vuelve a
 * validar sesión antes de llamar al API: React Router ejecuta loaders en
 * paralelo y no se puede depender del orden padre → hijo.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const api = getApi();
  const session = await requireConsoleSession(api, apiContext(request));

  return data(
    { admin: session.data.admin, expiresAt: session.data.expiresAt },
    { headers: consoleResponseHeaders(session.setCookies) },
  );
}

export default function AppLayout() {
  const { admin } = useLoaderData<typeof loader>();

  return (
    <AppShell adminEmail={admin.email}>
      <Outlet />
    </AppShell>
  );
}
