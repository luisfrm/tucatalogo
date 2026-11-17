import { Button, Input, cn } from "@tucatalogo/ui";

import { FieldShell } from "./field";
import { TurnstileWidget } from "./turnstile";
import type { FieldErrors, OtpPhase } from "./types";

export function OtpStep({
  email,
  slug,
  storeDomain,
  siteKey,
  token,
  onToken,
  resetSignal,
  phase,
  code,
  onCode,
  errors,
  notice,
  noticeTone,
  secondsLeft,
  expiresInMinutes,
  busy,
  onSend,
  onEdit,
  onTurnstileError,
}: {
  email: string;
  slug: string;
  storeDomain: string;
  siteKey: string;
  token: string | null;
  onToken: (token: string | null) => void;
  resetSignal: number;
  phase: OtpPhase;
  code: string;
  onCode: (code: string) => void;
  errors: FieldErrors;
  notice: string | null;
  noticeTone: "info" | "error";
  secondsLeft: number;
  expiresInMinutes: number;
  busy: boolean;
  onSend: () => void;
  onEdit: () => void;
  onTurnstileError: () => void;
}) {
  const awaitingCode = phase === "sent" || phase === "verifying";
  const canResend = !busy && Boolean(token) && secondsLeft === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <p className="text-sm text-text">
          Enviaremos un código de 6 dígitos a{" "}
          <span className="font-semibold">{email}</span>.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Tienda: <span className="font-medium text-text">{slug}.{storeDomain}</span>
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0 py-0"
          onClick={onEdit}
        >
          Cambiar datos
        </Button>
      </div>

      {notice ? (
        <p
          role={noticeTone === "error" ? "alert" : "status"}
          aria-live={noticeTone === "error" ? "assertive" : "polite"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            noticeTone === "error"
              ? "border-danger bg-surface text-danger"
              : "border-border bg-surface text-text-muted",
          )}
        >
          {notice}
        </p>
      ) : null}

      {awaitingCode ? (
        <FieldShell
          id="signup-code"
          label="Código de verificación"
          hint={`Caduca en ${expiresInMinutes} minutos. Revisa también la carpeta de spam.`}
          error={errors.code}
        >
          {({ describedBy, invalid }) => (
            <Input
              id="signup-code"
              name="code"
              size="lg"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) =>
                onCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-describedby={describedBy}
              invalid={invalid}
              className="text-center text-lg tracking-[0.4em]"
              required
            />
          )}
        </FieldShell>
      ) : null}

      <TurnstileWidget
        siteKey={siteKey}
        onToken={onToken}
        onError={onTurnstileError}
        resetSignal={resetSignal}
      />

      {errors.turnstileToken ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {errors.turnstileToken}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {awaitingCode ? (
          <Button type="submit" size="lg" disabled={busy}>
            {phase === "verifying" ? "Creando tu tienda…" : "Verificar y crear mi tienda"}
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={busy || !token || secondsLeft > 0}
          >
            {phase === "sending"
              ? "Enviando código…"
              : secondsLeft > 0
                ? `Espera ${secondsLeft} s`
                : "Enviar código"}
          </Button>
        )}

        {awaitingCode ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onSend}
            disabled={!canResend}
          >
            {secondsLeft > 0 ? `Reenviar en ${secondsLeft} s` : "Reenviar código"}
          </Button>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        Cuando el código sea correcto crearemos tu tienda. No iniciamos sesión
        automáticamente: entrarás al panel con tu email y contraseña en el dominio de
        tu tienda.
      </p>
    </div>
  );
}
