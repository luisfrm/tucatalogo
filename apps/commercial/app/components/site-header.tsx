import { useState } from "react";
import { Link } from "react-router";

import {
  BrandMark,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tucatalogo/ui";

function BrandMarkTile() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-cta text-on-primary shadow-sm"
    >
      <BrandMark className="size-full" />
    </span>
  );
}

const SECTION_LINKS = [
  { href: "#temas", label: "Temas" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

/**
 * Landing header with responsive mobile navigation drawer (`Dialog`).
 */
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        >
          <BrandMarkTile />
          <span className="font-display text-[17px] leading-none font-semibold tracking-tight text-text">
            TuCatálogo
          </span>
        </Link>

        {compact ? (
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 text-sm font-medium text-text-muted underline decoration-border-strong underline-offset-4 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
          >
            Volver al inicio
          </Link>
        ) : (
          <>
            <nav
              aria-label="Secciones de la página"
              className="hidden items-center gap-1 md:flex"
            >
              {SECTION_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="sm:h-11">
                <Link to="/registro">Crear mi catálogo</Link>
              </Button>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="md:hidden"
                    aria-label="Abrir menú de navegación"
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </Button>
                </DialogTrigger>
                <DialogContent side="right">
                  <DialogHeader>
                    <DialogTitle>TuCatálogo</DialogTitle>
                  </DialogHeader>
                  <nav
                    aria-label="Navegación móvil"
                    className="mt-4 flex flex-col gap-1"
                  >
                    {SECTION_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-base font-medium text-text hover:bg-surface-2"
                      >
                        {link.label}
                      </a>
                    ))}
                  </nav>
                  <div className="mt-6 border-t border-border pt-4">
                    <Button asChild size="lg" fullWidth>
                      <Link to="/registro" onClick={() => setOpen(false)}>
                        Crear mi catálogo gratis
                      </Link>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
