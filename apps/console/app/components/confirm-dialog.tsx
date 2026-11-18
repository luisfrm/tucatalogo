import { Button } from "@tucatalogo/ui";
import { useEffect, useRef, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

export interface DialogResult {
  ok: boolean;
  intent: string;
}

/**
 * Diálogo de confirmación de una acción destructiva (PLAN §11.2).
 *
 * Usa `<dialog>` nativo (focus trap y Escape gratis) y un `<Form method="post">`
 * same-origin. El action vuelve a validar en servidor; aquí solo se pide el
 * motivo o el slug exacto. Se cierra solo cuando el action responde `ok`.
 */
export function ConfirmDialog({
  intent,
  triggerLabel,
  title,
  description,
  submitLabel,
  variant = "danger",
  children,
  result,
}: {
  intent: string;
  triggerLabel: string;
  title: string;
  description: string;
  submitLabel: string;
  variant?: "danger" | "primary";
  children?: ReactNode;
  result?: DialogResult | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigation = useNavigation();
  const busy =
    navigation.state === "submitting" && navigation.formData?.get("intent") === intent;

  useEffect(() => {
    if (result?.ok && result.intent === intent) dialogRef.current?.close();
  }, [result, intent]);

  const titleId = `dialog-${intent}-title`;
  const descriptionId = `dialog-${intent}-description`;

  return (
    <>
      {/*
        El disparador es neutro (secundario): en la barra lateral conviven dos
        acciones destructivas y no deben competir como CTA. El tono `danger`
        aparece donde importa, en el botón que confirma dentro del diálogo.
      */}
      <Button variant="secondary" size="sm" onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[min(92vw,34rem)] max-h-[92dvh] overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text shadow-[var(--shadow-lg)]"
      >
        <Form method="post" className="grid gap-4 p-5">
          <input type="hidden" name="intent" value={intent} />
          <div className="grid gap-1">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-text-muted">
              {description}
            </p>
          </div>

          {children}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dialogRef.current?.close()}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" variant={variant} size="sm" disabled={busy}>
              {busy ? "Procesando…" : submitLabel}
            </Button>
          </div>
        </Form>
      </dialog>
    </>
  );
}
