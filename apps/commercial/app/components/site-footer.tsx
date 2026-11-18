import { Link } from "react-router";

const FOOTER_LINKS = [
  { to: "/registro", label: "Crear mi catálogo" },
  { to: "/terminos", label: "Términos del servicio" },
  { to: "/privacidad", label: "Aviso de privacidad" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-accent"
              />
              <p className="font-display text-[17px] leading-none font-semibold tracking-tight text-text">
                TuCatálogo
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Catálogos de tienda con pedidos por WhatsApp. Un enlace propio, un panel
              sencillo y cinco temas para que tu marca se vea como es.
            </p>
          </div>

          <nav
            aria-label="Enlaces del pie"
            className="flex flex-col gap-0.5 text-sm sm:items-end"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.to}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] text-text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-text hover:decoration-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TuCatálogo</p>
          <p>Hecho para negocios que venden por WhatsApp.</p>
        </div>
      </div>
    </footer>
  );
}
