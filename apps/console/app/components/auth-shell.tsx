import type { ReactNode } from "react";

import { ConsoleBrand } from "./brand";

/**
 * Marco de las pantallas públicas del console (login, init, 2FA, reset).
 *
 * Misma cabecera degradada que el shell autenticado: quien entra reconoce el
 * producto desde el primer píxel. La tarjeta del formulario, en cambio, es
 * neutra (`surface` + `border`), porque ahí no manda la marca sino el campo.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="[background-image:var(--gradient-header)] shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <ConsoleBrand />
          <span className="hidden text-xs text-on-primary/90 sm:inline">
            Backoffice de tiendas
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <section
          className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-md)] sm:p-6`}
        >
          <div className="mb-5 grid gap-1.5 border-b border-border pb-4">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-text">
              {title}
            </h1>
            {description ? <p className="text-sm text-text-muted">{description}</p> : null}
          </div>
          {children}
          {footer ? (
            <footer className="mt-5 border-t border-border pt-4 text-sm text-text-muted">
              {footer}
            </footer>
          ) : null}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-xs text-text-muted sm:px-6">
        Acceso restringido. Toda acción queda registrada en la auditoría.
      </footer>
    </div>
  );
}
