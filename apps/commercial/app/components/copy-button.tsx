import { useEffect, useState } from "react";

import { Button } from "@tucatalogo/ui";

/**
 * Copiar un enlace al portapapeles con confirmación accesible.
 * Si el navegador niega el permiso se avisa: nunca se finge que copió.
 */
export function CopyButton({
  value,
  label = "Copiar enlace",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
        {status === "copied" ? "Copiado" : label}
      </Button>
      <span role="status" aria-live="polite" className="text-xs text-text-muted">
        {status === "copied"
          ? "Enlace copiado al portapapeles."
          : status === "error"
            ? "No pudimos copiar. Selecciona el enlace y cópialo a mano."
            : ""}
      </span>
    </span>
  );
}
