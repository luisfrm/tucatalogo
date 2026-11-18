import { Button, Input } from "@tucatalogo/ui";
import { useState } from "react";

/**
 * Secreto de una sola vez (TOTP URI y backup codes). No se persiste en
 * `localStorage`, `sessionStorage` ni cookies: solo vive en el HTML del action.
 */

function useCopy() {
  const [copied, setCopied] = useState(false);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return { copied, copy };
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor="totp-uri"
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted"
      >
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="totp-uri"
          readOnly
          value={value}
          className="font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="secondary" size="sm" onClick={() => void copy(value)}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        Añade esta URI en tu app autenticadora (Google Authenticator, 1Password, Aegis…). Si el
        botón Copiar falla, selecciona el texto y cópialo manualmente.
      </p>
    </div>
  );
}

export function BackupCodes({ codes }: { codes: string[] }) {
  const { copied, copy } = useCopy();
  const joined = codes.join("\n");

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          Códigos de respaldo
        </p>
        <Button variant="secondary" size="sm" onClick={() => void copy(joined)}>
          {copied ? "Copiados" : "Copiar todos"}
        </Button>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 font-mono text-xs sm:grid-cols-2">
        {codes.map((code, index) => (
          <li key={`${index}-${code}`} className="select-all">
            {code}
          </li>
        ))}
      </ul>
      <p className="text-xs font-medium text-warning">
        Guárdalos ahora. No volverás a verlos y cada uno sirve una sola vez.
      </p>
    </div>
  );
}
