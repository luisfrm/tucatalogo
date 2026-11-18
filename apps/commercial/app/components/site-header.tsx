import { Link } from "react-router";

import { Button } from "@tucatalogo/ui";

/**
 * Marca: etiqueta de catálogo dibujada a mano (SVG propio, sin emoji) sobre el
 * degradado de conversión. El glifo usa `on-primary`, que tiene 7.9:1 sobre el
 * stop más claro del degradado.
 */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-cta text-on-primary shadow-sm"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M20.6 13.1 12.9 20.8a2 2 0 0 1-2.8 0L3.2 13.9a2 2 0 0 1-.6-1.4V5a1.8 1.8 0 0 1 1.8-1.8h7.5a2 2 0 0 1 1.4.6l7.3 7.2a1.6 1.6 0 0 1 0 2.1Z" />
        <path d="M7.6 7.6h.01" />
      </svg>
    </span>
  );
}

const SECTION_LINKS = [
  { href: "#temas", label: "Temas" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

/**
 * Cabecera de la landing. En `/registro` se usa la variante compacta: el
 * formulario no debe competir con la navegación de marketing.
 *
 * Sticky sobre superficie translúcida: el degradado del hero se intuye al
 * hacer scroll sin perder el contraste del texto ni el foco visible.
 */
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        >
          <BrandMark />
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
            <Button asChild size="sm" className="sm:h-11">
              <Link to="/registro">Crear mi catálogo</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
