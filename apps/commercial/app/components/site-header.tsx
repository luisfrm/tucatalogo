import { Link } from "react-router";

import { Button } from "@tucatalogo/ui";

/**
 * Cabecera de la landing. En `/registro` se usa la variante compacta: el
 * formulario no debe competir con la navegación de marketing.
 */
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-heading text-base font-semibold tracking-tight text-text"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-md bg-primary text-xs font-semibold text-on-primary"
          >
            TC
          </span>
          <span>TuCatálogo</span>
        </Link>

        {compact ? (
          <Link
            to="/"
            className="text-sm font-medium text-text-muted underline underline-offset-4 hover:text-text"
          >
            Volver al inicio
          </Link>
        ) : (
          <>
            <nav
              aria-label="Secciones de la página"
              className="hidden items-center gap-6 text-sm text-text-muted md:flex"
            >
              <a className="hover:text-text" href="#temas">
                Temas
              </a>
              <a className="hover:text-text" href="#como-funciona">
                Cómo funciona
              </a>
              <a className="hover:text-text" href="#preguntas">
                Preguntas
              </a>
            </nav>
            <Button asChild size="sm">
              <Link to="/registro">Crear mi catálogo</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
