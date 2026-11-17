import { Link } from "react-router";

import type { ColorMode } from "@tucatalogo/types";

import { ColorModeToggle } from "./color-mode-toggle";
import type { StoreSummary } from "~/lib/store-context";
import { homeHref } from "~/lib/urls";

/**
 * Marco del storefront: cabecera con la tienda y el selector de modo, contenido
 * y pie. Sin navegación decorativa: la home ya es el catálogo.
 */
export interface StorefrontShellProps {
  store: StoreSummary;
  mode: ColorMode;
  siteId: string | null;
  children: React.ReactNode;
}

export function StorefrontShell({ store, mode, siteId, children }: StorefrontShellProps) {
  const home = homeHref({ siteId });
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 border-b-[length:var(--border-width)] border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to={home}
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          >
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full border-[length:var(--border-width)] border-border object-cover"
              />
            ) : null}
            <span className="truncate font-heading text-lg font-semibold leading-tight">
              {store.name}
            </span>
          </Link>

          <ColorModeToggle mode={mode} />
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <footer className="mt-12 border-t-[length:var(--border-width)] border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {store.name}
          </p>
          <p>Catálogo creado con TuCatálogo</p>
        </div>
      </footer>
    </div>
  );
}
