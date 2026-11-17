import { Outlet, useRouteLoaderData } from "react-router";

import type { Route } from "./+types/app-layout";

import { PanelShell } from "~/components/panel/panel-shell";
import { requirePanelContext } from "~/lib/panel.server";
import type { RootData } from "~/lib/store-context";

/**
 * Layout protegido: valida sesión en el loader (nunca en el cliente) y pinta
 * el marco con la ficha de la tienda. Cada página vuelve a pedir su contexto
 * porque un loader no comparte datos con sus hijos.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  return {
    siteId: context.siteId,
    store: context.store,
    user: { name: context.session.user.name, email: context.session.user.email },
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const data = matches.at(-1)?.loaderData as { store?: { name?: string } } | undefined;
  return [
    { title: `Panel · ${data?.store?.name ?? "Tu tienda"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function PanelAppLayout({ loaderData }: Route.ComponentProps) {
  // El modo del panel lo resuelve el root con su cookie propia; la tienda
  // conserva su `colorModeDefault` para el storefront.
  const root = useRouteLoaderData<RootData>("root");

  return (
    <PanelShell
      store={loaderData.store}
      user={loaderData.user}
      mode={root?.mode ?? "light"}
      siteId={loaderData.siteId}
    >
      <Outlet />
    </PanelShell>
  );
}
