import { buttonVariants, cn } from "@tucatalogo/ui";
import { isRouteErrorResponse, Link } from "react-router";

/**
 * Error de una sección autenticada. Se renderiza dentro del layout (la
 * navegación sigue disponible) y siempre muestra un mensaje accionable.
 *
 * Comparte patrón con el estado vacío: misma caja, mismo radio y misma escala
 * tipográfica. Solo cambia el tono del chip de error, que repite el patrón
 * texto + punto de los badges de estado (nunca color a secas).
 */
export function ProtectedRouteError({ error }: { error: unknown }) {
  const routeError = isRouteErrorResponse(error);
  const status = routeError ? error.status : 500;

  const title =
    status === 404
      ? "No encontramos esa tienda"
      : status === 403
        ? "No tienes acceso a esta sección"
        : "No pudimos cargar esta sección";

  const details =
    routeError && typeof error.data === "string" && error.data.trim() !== ""
      ? error.data
      : status === 404
        ? "Puede que se haya eliminado o que el enlace no sea correcto."
        : "Inténtalo de nuevo en unos instantes. Si persiste, revisa el estado del API.";

  return (
    <section className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <p className="inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-full)] border border-danger/40 bg-danger/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        Error {status}
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="max-w-prose text-sm leading-relaxed text-text-muted">{details}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link to="/" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
          Volver a tiendas
        </Link>
        <Link to="/auditoria" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Ver auditoría
        </Link>
      </div>
    </section>
  );
}
