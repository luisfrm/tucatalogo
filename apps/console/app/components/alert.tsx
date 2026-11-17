import { cn } from "@tucatalogo/ui";
import type { ReactNode } from "react";

/** Aviso inline con rol correcto: `alert` para errores, `status` para el resto. */
export type AlertTone = "error" | "success" | "info" | "warning";

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success",
  info: "border-border-strong/50 bg-surface-2 text-text",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

const TONE_TITLES: Record<AlertTone, string> = {
  error: "No se pudo completar",
  success: "Listo",
  info: "Información",
  warning: "Atención",
};

export function Alert({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <p className="font-semibold">{title ?? TONE_TITLES[tone]}</p>
      {children ? <div className="mt-0.5 text-sm leading-relaxed">{children}</div> : null}
    </div>
  );
}

/** Lista de errores por campo devuelta por un action. */
export function FieldErrorSummary({ errors }: { errors?: Record<string, string> }) {
  const entries = Object.entries(errors ?? {});
  if (entries.length === 0) return null;

  return (
    <Alert tone="error" title="Revisa el formulario">
      <ul className="list-inside list-disc">
        {entries.map(([field, message]) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </Alert>
  );
}
