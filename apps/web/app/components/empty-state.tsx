import { cn } from "@tucatalogo/ui";
import { Link } from "react-router";

/** Estado vacío/neutral reutilizable en catálogo y búsqueda. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border-[length:var(--border-width)] border-border bg-surface px-6 py-10 text-center">
      <p className="font-heading text-lg font-semibold">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function CategoryChip({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border-[length:var(--border-width)] px-4 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-border-strong bg-surface text-text hover:bg-surface-2",
      )}
    >
      {children}
    </Link>
  );
}
