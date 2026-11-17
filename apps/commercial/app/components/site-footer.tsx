import { Link } from "react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="font-heading text-base font-semibold text-text">TuCatálogo</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Catálogos de tienda con pedidos por WhatsApp. Un enlace propio, un panel
              sencillo y cinco temas para que tu marca se vea como es.
            </p>
          </div>

          <nav aria-label="Enlaces del pie" className="flex flex-col gap-2 text-sm">
            <Link className="text-text-muted hover:text-text" to="/registro">
              Crear mi catálogo
            </Link>
            <Link className="text-text-muted hover:text-text" to="/terminos">
              Términos del servicio
            </Link>
            <Link className="text-text-muted hover:text-text" to="/privacidad">
              Aviso de privacidad
            </Link>
          </nav>
        </div>

        <p className="mt-8 border-t border-border pt-6 text-xs text-text-muted">
          © {new Date().getFullYear()} TuCatálogo · Hecho para negocios que venden por
          WhatsApp.
        </p>
      </div>
    </footer>
  );
}
