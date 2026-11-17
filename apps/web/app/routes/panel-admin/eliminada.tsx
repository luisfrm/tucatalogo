import { Link } from "react-router";

import type { Route } from "./+types/eliminada";

import { panelHref } from "~/lib/urls";

/**
 * Confirmación neutral del borrado. No depende de sesión, tienda ni tema:
 * cuando esta página se muestra, la fila de `store` y `store_users` ya no
 * existen. No hay enlaces que asuman una tienda viva.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return { siteId: url.searchParams.get("siteId") };
}

export function meta() {
  return [
    { title: "Tienda eliminada" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function PanelStoreDeleted({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-border bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
        <p aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--color-primary-subtle)] text-xl">
          ✓
        </p>
        <h1 className="mt-3 font-heading text-2xl font-semibold">Tienda eliminada</h1>
        <p className="mt-2 text-sm text-text-muted">
          Borramos la tienda, sus productos, categorías, imágenes y la cuenta del dueño. El
          identificador queda reservado durante 90 días y después vuelve a estar disponible.
        </p>
        <p className="mt-3 text-xs text-text-muted">
          Si necesitas una tienda nueva, vuelve a registrarte desde TuCatálogo.
        </p>
        <div className="mt-4">
          <Link
            to={panelHref("login", { siteId: loaderData.siteId })}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Ir al acceso del panel
          </Link>
        </div>
      </div>
    </main>
  );
}
