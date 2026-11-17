import type { PanelStore } from "@tucatalogo/types";
import { Button, cn } from "@tucatalogo/ui";
import type { ReactNode } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";

import { homeHref, panelHref } from "~/lib/urls";
import type { ColorMode } from "@tucatalogo/types";

import { PanelAlert, StatusBadge } from "./panel-ui";

/**
 * Marco del panel del dueño: navegación lateral en escritorio, colapsable en
 * móvil, banner de suspensión persistente y acciones de sesión/modo.
 *
 * La suspensión no bloquea el panel (PLAN §4.5 G): el dueño solo puede
 * reactivar cuando `suspendedBy = owner`; si suspendió el console se muestra el
 * motivo y no se ofrece reactivar.
 */
export interface PanelShellProps {
  store: PanelStore;
  user: { name: string; email: string };
  mode: ColorMode;
  siteId: string | null;
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: "", label: "Resumen", end: true },
  { to: "productos", label: "Productos" },
  { to: "categorias", label: "Categorías" },
  { to: "hero", label: "Hero" },
  { to: "settings", label: "Ajustes" },
] as const;

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
    isActive
      ? "bg-[var(--color-primary-subtle)] text-text"
      : "text-text-muted hover:bg-surface-2 hover:text-text",
  );
}

function NavList({
  siteId,
  onNavigate,
}: {
  siteId: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavLink
            to={panelHref(item.to, { siteId })}
            end={"end" in item ? item.end : undefined}
            className={navLinkClasses}
            onClick={onNavigate}
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function PanelShell({ store, user, mode, siteId, children }: PanelShellProps) {
  const location = useLocation();
  const suspended = store.status === "suspended";
  const suspendedByAdmin = suspended && store.suspendedBy === "admin";
  const suspendedByOwner = suspended && store.suspendedBy === "owner";
  const redirectTo = `${location.pathname}${location.search}`;

  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        href="#panel-contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary"
      >
        Saltar al contenido
      </a>

      <div className="mx-auto flex w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b-[length:var(--border-width)] border-border bg-surface lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
            <Link
              to={panelHref("", { siteId })}
              className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full border-[length:var(--border-width)] border-border object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-subtle)] font-heading text-sm font-semibold"
                >
                  {store.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-heading text-base font-semibold leading-tight">
                  {store.name}
                </span>
                <span className="block truncate text-xs text-text-muted">{store.slug}</span>
              </span>
            </Link>

            <details className="lg:hidden">
              <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
                Menú
              </summary>
              <div className="absolute left-4 right-4 z-40 mt-2 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-2 shadow-[var(--shadow-lg)]">
                <NavList siteId={siteId} />
                <div className="mt-2 border-t border-border pt-2">
                  <Link
                    to={homeHref({ siteId })}
                    className="flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    Ver tienda
                  </Link>
                </div>
              </div>
            </details>
          </div>

          <div className="hidden px-3 pb-5 lg:block">
            <NavList siteId={siteId} />
            <div className="mt-4 border-t border-border pt-4">
              <Link
                to={homeHref({ siteId })}
                className="flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                Ver tienda
              </Link>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b-[length:var(--border-width)] border-border bg-bg/95 px-4 py-2.5 backdrop-blur sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <StatusBadge
                  tone={
                    store.status === "active"
                      ? "success"
                      : store.status === "suspended"
                        ? "danger"
                        : "warning"
                  }
                >
                  {store.status === "active"
                    ? "Activa"
                    : store.status === "suspended"
                      ? "Suspendida"
                      : "Pendiente"}
                </StatusBadge>
                <span className="hidden truncate text-xs text-text-muted sm:inline">{user.email}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Form method="post" action={panelHref("mode", { siteId })}>
                  <input type="hidden" name="color_mode" value={mode === "dark" ? "light" : "dark"} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={mode === "dark" ? "Usar modo claro" : "Usar modo oscuro"}>
                    {mode === "dark" ? "Claro" : "Oscuro"}
                  </Button>
                </Form>
                <Form method="post" action={panelHref("logout", { siteId })}>
                  <Button type="submit" variant="ghost" size="sm">
                    Salir
                  </Button>
                </Form>
              </div>
            </div>
          </header>

          <main id="panel-contenido" className="flex-1 px-4 py-5 sm:px-6 sm:py-7">
            <div className="flex flex-col gap-4">
              {suspended ? (
                <PanelAlert
                  tone={suspendedByAdmin ? "danger" : "warning"}
                  title={
                    suspendedByAdmin
                      ? "Tu tienda está suspendida por el equipo de TuCatálogo"
                      : "Tu tienda está suspendida"
                  }
                  action={
                    suspendedByOwner ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link to={panelHref("settings", { siteId })}>Reactivar</Link>
                      </Button>
                    ) : null
                  }
                >
                  {suspendedByAdmin ? (
                    <>
                      <p>El catálogo público responde 404. Puedes seguir consultando el panel, pero no reactivar la tienda desde aquí.</p>
                      {store.suspendedReason ? (
                        <p className="mt-1">
                          Motivo indicado: <strong>{store.suspendedReason}</strong>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p>
                      El catálogo público responde 404. Reactívala desde Ajustes cuando quieras
                      volver a publicar.
                    </p>
                  )}
                </PanelAlert>
              ) : null}

              {store.status === "pending" ? (
                <PanelAlert tone="warning" title="Tienda pendiente">
                  <p>La tienda aún no está publicada. Revisa los datos en Ajustes.</p>
                </PanelAlert>
              ) : null}

              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
