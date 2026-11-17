import { Link } from "react-router";
import type { ReactNode } from "react";

/** Marco de las pantallas públicas del console (login, init, 2FA, reset). */
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
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight">TuCatálogo</span>
            <span className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Console
            </span>
          </Link>
          <span className="text-xs text-text-muted">Backoffice de tiendas</span>
        </div>
      </header>

      <main className="mx-auto flex w-full flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <section
          className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-6`}
        >
          <div className="mb-5 grid gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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
