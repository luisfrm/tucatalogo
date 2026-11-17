import { Outlet } from "react-router";

/**
 * Raíz de `/panel-admin` dentro de `apps/web` (PLAN §4.2 / §5.3).
 *
 * No hay `basename`: el panel vive en el mismo host que el storefront y hereda
 * `?siteId` en dev/local. El root inyecta `data-surface="panel-admin"` y la
 * base neutral con el color de la tienda como acento.
 *
 * Este layout solo deja pasar el `Outlet`: las rutas públicas (login,
 * recuperación, eliminada) no deben cargar sesión, y las protegidas la validan
 * en su propio loader + en el layout `panel-admin/app-layout`.
 */
export function meta() {
  return [{ title: "Panel de la tienda" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function PanelAdminLayout() {
  return <Outlet />;
}
