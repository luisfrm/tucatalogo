import { buttonVariants } from "@tucatalogo/ui";
import { isRouteErrorResponse, Link } from "react-router";

/**
 * Error de una sección autenticada. Se renderiza dentro del layout (la
 * navegación sigue disponible) y siempre muestra un mensaje accionable.
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
    <section className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
        Error {status}
      </p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-prose text-sm text-text-muted">{details}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link to="/" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Volver a tiendas
        </Link>
        <Link to="/auditoria" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Ver auditoría
        </Link>
      </div>
    </section>
  );
}
