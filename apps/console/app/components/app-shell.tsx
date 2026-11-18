import { Button, cn } from "@tucatalogo/ui";
import { Form, Link, useLocation, useNavigation } from "react-router";
import type { ReactNode } from "react";

import { ConsoleBrand } from "./brand";

/**
 * Ítem de navegación del shell: el estado activo no es solo negrita, es una
 * píldora `surface` con el texto en `primary` (7.75:1) y un punto `accent` de
 * 6px como indicador. Los inactivos quedan en `onPrimary/90` sobre el
 * degradado (≈5.9:1) con hover translúcido.
 */
function navItemClasses(active: boolean): string {
  return cn(
    "focus-ring-inverse inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-surface text-primary shadow-[var(--shadow-sm)]"
      : "text-on-primary/90 hover:bg-on-primary/10 hover:text-on-primary",
  );
}

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={navItemClasses(active)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          active ? "bg-accent" : "bg-transparent",
        )}
      />
      {label}
    </Link>
  );
}

/**
 * Carcasa del console: densidad alta, mobile-first (PLAN §10.4/§11.2).
 *
 * La identidad vive en el marco: cabecera con `--gradient-header`, marca
 * compartida con `commercial`, navegación con estado activo explícito y una
 * barra de carga indeterminada para listado, ficha y auditoría. El contenido
 * se queda sobre papel cálido (`bg` → `surface`), sin fondos de color.
 *
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
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  const storesActive = location.pathname === "/" || location.pathname.startsWith("/tiendas");
  const auditActive = location.pathname.startsWith("/auditoria");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#contenido"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--radius-sm)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary"
      >
        Saltar al contenido
      </a>

      <span role="status" className="sr-only">
        {loading ? "Cargando contenido…" : ""}
      </span>

      <header className="sticky top-0 z-20 [background-image:var(--gradient-header)] shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <ConsoleBrand />

          <nav
            aria-label="Secciones"
            className="order-3 flex w-full items-center gap-1 sm:order-none sm:ml-3 sm:w-auto"
          >
            <NavItem to="/" label="Tiendas" active={storesActive} />
            <NavItem to="/auditoria" label="Auditoría" active={auditActive} />
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span
              className="hidden max-w-[220px] truncate text-xs text-on-primary/90 sm:inline"
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

        {loading ? (
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
            <div className="console-progress h-full w-1/3 bg-primary-subtle" />
          </div>
        ) : null}
      </header>

      <main
        id="contenido"
        aria-busy={loading || undefined}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-7"
      >
        {children}
      </main>
    </div>
  );
}
