import { useState } from "react";
import { Form, Link, useLocation } from "react-router";

import type { ColorMode, PublicCategory } from "@tucatalogo/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tucatalogo/ui";

import { ColorModeToggle } from "./color-mode-toggle";
import type { StoreSummary } from "~/lib/store-context";
import { homeHref, productsHref } from "~/lib/urls";

/**
 * Storefront shell: sticky header with store brand, navigation links,
 * mobile drawer, compact search, color mode toggle, and footer.
 */
export interface StorefrontShellProps {
  store: StoreSummary;
  categories: PublicCategory[];
  mode: ColorMode;
  siteId: string | null;
  children: React.ReactNode;
}

export function StorefrontShell({
  store,
  categories,
  mode,
  siteId,
  children,
}: StorefrontShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const home = homeHref({ siteId });
  const catalog = productsHref({ siteId });
  const year = new Date().getFullYear();

  const isProductsPage = location.pathname.startsWith("/productos");

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
          <div className="flex min-w-0 items-center gap-6">
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
                  className="size-9 shrink-0 rounded-full border-[length:var(--border-width)] border-border object-cover sm:size-10"
                />
              ) : null}
              <span className="truncate font-heading text-lg font-semibold leading-tight tracking-[var(--tracking-heading,normal)]">
                {store.name}
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
              <Link
                to={home}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  !isProductsPage
                    ? "bg-primary-subtle text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                ].join(" ")}
              >
                Inicio
              </Link>
              <Link
                to={catalog}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isProductsPage
                    ? "bg-primary-subtle text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                ].join(" ")}
              >
                Productos
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Form
              method="get"
              action="/productos"
              role="search"
              aria-label="Buscar productos"
              className="hidden items-center sm:flex"
            >
              {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
              <div className="relative">
                <input
                  type="search"
                  name="q"
                  placeholder="Buscar..."
                  aria-label="Buscar productos en el catálogo"
                  className="h-9 w-44 rounded-[var(--radius-button,var(--radius-md))] border-[length:var(--border-width)] border-border bg-surface px-3 pr-8 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none lg:w-56"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </button>
              </div>
            </Form>

            <ColorModeToggle mode={mode} />

            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir menú de navegación"
                  className="inline-flex size-9 items-center justify-center rounded-[var(--radius-button,var(--radius-md))] border-[length:var(--border-width)] border-border bg-surface text-text hover:bg-surface-2 md:hidden"
                >
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{store.name}</DialogTitle>
                  <DialogDescription>Explora el catálogo y sus categorías.</DialogDescription>
                </DialogHeader>

                <Form
                  method="get"
                  action="/productos"
                  onSubmit={() => setMenuOpen(false)}
                  className="mt-2 flex gap-2"
                >
                  {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
                  <input
                    type="search"
                    name="q"
                    placeholder="Buscar producto..."
                    aria-label="Buscar producto"
                    className="h-10 flex-1 rounded-[var(--radius-button,var(--radius-md))] border-[length:var(--border-width)] border-border bg-surface px-3 text-sm text-text"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-[var(--radius-button,var(--radius-md))] bg-primary px-4 text-sm font-medium text-on-primary"
                  >
                    Ir
                  </button>
                </Form>

                <nav aria-label="Menú móvil" className="mt-4 flex flex-col gap-1">
                  <Link
                    to={home}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-surface-2"
                  >
                    Inicio
                  </Link>
                  <Link
                    to={catalog}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-surface-2"
                  >
                    Todos los productos
                  </Link>
                  {categories.length > 0 ? (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="px-3 py-1 text-xs font-semibold tracking-wider text-text-muted uppercase">
                        Categorías
                      </p>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          to={productsHref({ category: cat.slug, siteId })}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
                        >
                          <span>{cat.name}</span>
                          <span className="text-xs tabular-nums">{cat.productCount}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </nav>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <footer className="mt-14 border-t-[length:var(--border-width)] border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-heading font-semibold text-text">{store.name}</p>
            <p className="mt-0.5 text-xs">
              © {year} {store.name} · Catálogo creado con TuCatálogo
            </p>
          </div>

          <nav aria-label="Enlaces del pie" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
            <Link to={home} className="hover:text-text">
              Inicio
            </Link>
            <Link to={catalog} className="hover:text-text">
              Productos
            </Link>
            {categories.slice(0, 4).map((cat) => (
              <Link
                key={cat.id}
                to={productsHref({ category: cat.slug, siteId })}
                className="hover:text-text"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
