import { Button, cn } from "@tucatalogo/ui";
import { Form, Link, NavLink, useLocation } from "react-router";
import type { ReactNode } from "react";

/**
 * Carcasa del console: densidad alta, neutra, mobile-first (PLAN §10.4/§11.2).
 * El logout es un POST (`/logout`); nunca un GET.
 */
export function AppShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: ReactNode;
}) {
  const location = useLocation();
  const storesActive = location.pathname === "/" || location.pathname.startsWith("/tiendas");

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-text">TuCatálogo</span>
            <span className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Console
            </span>
          </Link>

          <nav aria-label="Secciones" className="flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={cn(
                "rounded-[var(--radius-sm)] px-2 py-1 font-medium",
                storesActive
                  ? "bg-primary-subtle text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              Tiendas
            </NavLink>
            <NavLink
              to="/auditoria"
              className={({ isActive }) =>
                cn(
                  "rounded-[var(--radius-sm)] px-2 py-1 font-medium",
                  isActive
                    ? "bg-primary-subtle text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                )
              }
            >
              Auditoría
            </NavLink>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span
              className="hidden max-w-[220px] truncate text-xs text-text-muted sm:inline"
              title={adminEmail}
            >
              {adminEmail}
            </span>
            <Form method="post" action="/logout">
              <Button type="submit" variant="secondary" size="sm">
                Cerrar sesión
              </Button>
            </Form>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
