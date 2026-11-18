import { cn } from "@tucatalogo/ui";
import type { ReactNode } from "react";

/** Aviso inline con rol correcto: `alert` para errores, `status` para el resto. */
export type AlertTone = "error" | "success" | "info" | "warning";

/**
 * Un aviso no tiñe el texto del cuerpo: el tono va en el borde, el punto y el
 * título, y el contenido se queda en `text` (16:1 sobre `surface`). Así un
 * formulario con tres avisos sigue siendo legible y el color solo distingue
 * el tipo, nunca transporta el mensaje.
 */
const TONE_CLASSES: Record<AlertTone, { box: string; title: string; dot: string }> = {
  error: {
    box: "border-danger/35 bg-danger/5",
    title: "text-danger",
    dot: "bg-danger",
  },
  success: {
    box: "border-success/35 bg-success/5",
    title: "text-success",
    dot: "bg-success",
  },
  warning: {
    box: "border-warning/35 bg-warning/5",
    title: "text-warning",
    dot: "bg-warning",
  },
  info: {
    box: "border-border-strong/50 bg-surface-2",
    title: "text-text",
    dot: "bg-text-muted",
  },
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
  const styles = TONE_CLASSES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm",
        styles.box,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", styles.dot)}
      />
      <div className="min-w-0">
        <p className={cn("font-semibold", styles.title)}>{title ?? TONE_TITLES[tone]}</p>
        {children ? (
          <div className="mt-0.5 text-sm leading-relaxed text-text">{children}</div>
        ) : null}
      </div>
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
