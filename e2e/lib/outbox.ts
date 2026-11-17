import { API_URL } from "./config";

/**
 * Outbox de email local (`GET /dev/outbox?to=…`).
 *
 * Con `EMAIL_DRIVER=memory` el API guarda el último correo por destinatario y lo
 * expone solo en local. Aquí se hace polling hasta que aparece, sin esperas
 * fijas.
 */
export interface OutboxEntry {
  to: string;
  kind: "otp" | "reset" | string;
  subject: string;
  text: string;
  createdAt: string;
  code?: string;
  resetUrl?: string;
}

async function fetchEntry(url: string): Promise<OutboxEntry | null> {
  const response = await fetch(url, { headers: { "cache-control": "no-store" } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Outbox respondió ${response.status} en ${url}`);
  }
  return (await response.json()) as OutboxEntry;
}

export async function waitForOutbox(
  to: string,
  predicate: (entry: OutboxEntry) => boolean,
  { timeoutMs = 20_000, intervalMs = 300 } = {},
): Promise<OutboxEntry> {
  const url = `${API_URL}/dev/outbox?to=${encodeURIComponent(to)}`;
  const deadline = Date.now() + timeoutMs;
  let last: OutboxEntry | null = null;

  while (Date.now() < deadline) {
    const entry = await fetchEntry(url);
    if (entry && predicate(entry)) return entry;
    last = entry ?? last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `No llegó el correo esperado para ${to} en ${timeoutMs} ms (último: ${JSON.stringify(last)})`,
  );
}

/** OTP de 6 caracteres del registro (o del 2FA por email, si aplicara). */
export async function waitForSignupCode(email: string): Promise<string> {
  const entry = await waitForOutbox(email, (item) => item.kind === "otp" && Boolean(item.code));
  return entry.code!;
}

/** Enlace absoluto del correo de recuperación de contraseña. */
export async function waitForResetUrl(email: string): Promise<string> {
  const entry = await waitForOutbox(email, (item) => item.kind === "reset" && Boolean(item.resetUrl));
  return entry.resetUrl!;
}
