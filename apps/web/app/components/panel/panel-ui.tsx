import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  cn,
} from "@tucatalogo/ui";
import type { ReactNode } from "react";
import { Form, Link } from "react-router";

import { panelHref, totalPages } from "~/lib/urls";

/**
 * Piezas visuales del panel: densidad media, mobile-first, tokens semánticos.
 * Ningún color va en hex; el acento lo pone el surface admin del root.
 */

export function PanelPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-xl font-semibold leading-tight sm:text-2xl">{title}</h1>
        {description ? (
          <div className="mt-1 max-w-2xl text-sm text-text-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelCard({
  children,
  className,
  as: Component = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-border bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function PanelAlert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "border-border-strong bg-surface-2 text-text",
    success: "border-success/40 bg-surface text-text",
    warning: "border-warning/50 bg-surface text-text",
    danger: "border-danger/50 bg-surface text-text",
  } as const;
  const dot = {
    info: "bg-text-muted",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-md)] border-[length:var(--border-width)] p-3 text-sm sm:flex-row sm:items-start sm:justify-between",
        tones[tone],
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot[tone])} />
        <div className="min-w-0">
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className={cn(title ? "mt-0.5" : "", "text-text-muted")}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PanelEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface px-5 py-10 text-center">
      <p className="font-heading text-base font-semibold">{title}</p>
      {description ? (
        <div className="mx-auto mt-1 max-w-md text-sm text-text-muted">{description}</div>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PanelStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    success: "border-success/50 text-text",
    warning: "border-warning/60 text-text",
    danger: "border-danger/60 text-text",
    neutral: "border-border-strong text-text-muted",
  } as const;
  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-text-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[length:var(--border-width)] bg-surface px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot[tone])} />
      {children}
    </span>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PanelFlash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-success/50 bg-surface px-3 py-2 text-sm text-text"
    >
      <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-success align-middle" />
      {message}
    </div>
  );
}

export function PanelPagination({
  page,
  pageSize,
  total,
  basePath,
  query,
  siteId,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query: Record<string, string | number | null | undefined>;
  siteId: string | null;
}) {
  const pages = totalPages(total, pageSize);
  if (pages <= 1) return null;

  const href = (targetPage: number) =>
    panelHref(basePath, {
      siteId,
      query: { ...query, page: targetPage > 1 ? targetPage : null },
    });

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          to={href(page - 1)}
          rel="prev"
          className="inline-flex h-11 items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:h-9"
        >
          Anterior
        </Link>
      ) : (
        <span className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-border px-4 text-sm text-text-muted opacity-60 sm:h-9">
          Anterior
        </span>
      )}
      <p className="text-sm text-text-muted" aria-live="polite">
        Página {page} de {pages} · {total} {total === 1 ? "elemento" : "elementos"}
      </p>
      {page < pages ? (
        <Link
          to={href(page + 1)}
          rel="next"
          className="inline-flex h-11 items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:h-9"
        >
          Siguiente
        </Link>
      ) : (
        <span className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-border px-4 text-sm text-text-muted opacity-60 sm:h-9">
          Siguiente
        </span>
      )}
    </nav>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {message}
    </p>
  );
}

/**
 * Reusable Radix AlertDialog confirmation for destructive panel actions.
 * Submits a standard POST form with `confirm="eliminar"` so server actions stay unchanged.
 */
export function ConfirmDeleteDialog({
  triggerLabel = "Eliminar",
  title,
  description,
  confirmLabel = "Eliminar",
  intent,
  fields,
  disabled,
}: {
  triggerLabel?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  intent: string;
  fields?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-danger hover:bg-surface-2" disabled={disabled}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Form method="post" className="mt-2">
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="confirm" value="eliminar" />
          {fields
            ? Object.entries(fields).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))
            : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="secondary" size="md">
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button type="submit" variant="danger" size="md" disabled={disabled}>
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
