import { Link } from "react-router";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Envoltura común de las páginas legales (texto plano, sin decoración). */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader compact />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
          Legal
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-text">
          {title}
        </h1>
        <p className="mt-2 text-sm text-text-muted">Última actualización: {updatedAt}</p>

        <div
          className="mt-8 text-sm leading-relaxed text-text-muted [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text [&_li]:mt-1 [&_p]:mt-2 [&_strong]:font-semibold [&_strong]:text-text [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {children}
        </div>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-text-muted">
          Si algo de este documento no te queda claro, escríbenos desde el correo con
          el que creaste tu cuenta y te respondemos antes de que tomes cualquier
          decisión.
        </p>
        <Link
          className="mt-4 inline-block text-sm text-primary underline underline-offset-4"
          to="/"
        >
          Volver al inicio
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
