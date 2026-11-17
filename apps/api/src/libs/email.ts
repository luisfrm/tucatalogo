/**
 * Envío de correos (PLAN §7.3 / §7.6). Driver **explícito**, sin fallback:
 *
 * - `console`: imprime el asunto y el texto en el log (**solo local**; fuera
 *   de local es 503 + log, para no filtrar OTP/enlaces en los logs — M4).
 * - `resend`:  `https://api.resend.com/emails`. Sin `RESEND_API_KEY` → 503.
 * - `memory`:  buzón en memoria del isolate (local/E2E y tests). No escribe en
 *   logs ni en D1; expone `GET /dev/outbox` solo con `ENVIRONMENT=local`.
 *
 * Las plantillas están en español; ninguna credencial sale por el log fuera de
 * local.
 */
import type { Env } from "../env";
import { AppError } from "../errors";
import { AUTH_MESSAGES } from "../constants/auth";

/** Tipo de correo, para que el outbox de desarrollo se pueda filtrar. */
export type EmailKind = "otp" | "reset";

export interface EmailMessage {
  to: string;
  kind: EmailKind;
  subject: string;
  text: string;
  html: string;
  /** Solo en `kind: "otp"`. */
  code?: string;
  /** Solo en `kind: "reset"`: enlace absoluto de un solo uso. */
  resetUrl?: string;
}

export interface EmailDriver {
  readonly name: "console" | "resend" | "memory";
  send(message: EmailMessage): Promise<void>;
}

/** Buzón de pruebas: solo lo lee `EMAIL_DRIVER=memory` en los tests. */
export const emailOutbox: EmailMessage[] = [];

/**
 * Entrada del outbox de desarrollo: el último correo por destinatario, con lo
 * necesario para completar un flujo E2E (código OTP o enlace de reset).
 * Vive **solo en memoria del isolate** y nunca se registra ni se persiste.
 */
export interface DevOutboxEntry {
  to: string;
  kind: EmailKind;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
  code?: string;
  resetUrl?: string;
}

/** Tope del ring buffer: se descarta el destinatario más antiguo. */
export const DEV_OUTBOX_LIMIT = 50;

const devOutbox = new Map<string, DevOutboxEntry>();

function normalizeAddress(to: string): string {
  return to.trim().toLowerCase();
}

/**
 * Guarda el correo como "último de ese destinatario". El `Map` conserva el
 * orden de inserción, así que borrar y volver a insertar mueve la entrada al
 * final y el recorte siempre descarta la más antigua.
 */
export function recordDevOutboxEntry(entry: DevOutboxEntry): void {
  const key = normalizeAddress(entry.to);
  devOutbox.delete(key);
  devOutbox.set(key, entry);

  while (devOutbox.size > DEV_OUTBOX_LIMIT) {
    const oldest = devOutbox.keys().next().value;
    if (oldest === undefined) break;
    devOutbox.delete(oldest);
  }
}

export function findDevOutboxEntry(to: string): DevOutboxEntry | undefined {
  return devOutbox.get(normalizeAddress(to));
}

/** Último correo emitido, sea cual sea el destinatario. */
export function lastDevOutboxEntry(): DevOutboxEntry | undefined {
  let last: DevOutboxEntry | undefined;
  for (const entry of devOutbox.values()) last = entry;
  return last;
}

/** Nº de destinatarios en el outbox (diagnóstico y tests). */
export function devOutboxSize(): number {
  return devOutbox.size;
}

export interface DevOutboxEnv {
  ENVIRONMENT: string;
  EMAIL_DRIVER?: string;
}

/**
 * El outbox de desarrollo solo existe con `ENVIRONMENT=local` y
 * `EMAIL_DRIVER=memory`. En cualquier otro caso la ruta responde 404 (no hay
 * bypass por cabecera ni por query).
 */
export function isDevOutboxEnabled(env: DevOutboxEnv): boolean {
  return env.ENVIRONMENT === "local" && env.EMAIL_DRIVER === "memory";
}

/** Vacía el buzón de pruebas y el outbox de desarrollo (tests entre casos). */
export function clearEmailOutbox(): void {
  emailOutbox.length = 0;
  devOutbox.clear();
}


/** Último correo dirigido a `to` (o `undefined`). */
export function findLastEmailTo(to: string): EmailMessage | undefined {
  const normalized = to.trim().toLowerCase();
  for (let i = emailOutbox.length - 1; i >= 0; i -= 1) {
    const message = emailOutbox[i];
    if (message && message.to.toLowerCase() === normalized) {
      return message;
    }
  }
  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((text) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`).join("");
  const action = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#C09299;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#FFF8F7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2C1D21">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
      ${body}
      ${action}
      <p style="margin:24px 0 0;font-size:12px;color:#6B565B">TuCatálogo</p>
    </div>
  </body>
</html>`;
}

export interface OtpEmailInput {
  to: string;
  code: string;
  minutes: number;
}

export function buildOtpEmail({ to, code, minutes }: OtpEmailInput): EmailMessage {
  const title = "Tu código de verificación";
  const paragraphs = [
    `Usa este código para terminar tu registro: ${code}`,
    `Caduca en ${minutes} minutos y solo se puede usar una vez.`,
    "Si no pediste este código, ignora este correo.",
  ];
  return {
    to,
    kind: "otp",
    subject: "Tu código de verificación · TuCatálogo",
    text: `${title}\n\n${paragraphs.join("\n")}\n`,
    html: renderHtml(title, paragraphs),
    code,
  };
}

export interface PasswordResetEmailInput {
  to: string;
  url: string;
  minutes: number;
  audience: "store" | "console";
}

export function buildPasswordResetEmail({
  to,
  url,
  minutes,
  audience,
}: PasswordResetEmailInput): EmailMessage {
  const title = "Recupera tu contraseña";
  const intros =
    audience === "console"
      ? [
          "Recibimos una solicitud para restablecer la contraseña de tu cuenta de administración.",
          `El enlace caduca en ${minutes} minutos y solo se puede usar una vez.`,
          "Si no lo pediste, ignora este correo: tu contraseña no cambia.",
        ]
      : [
          "Recibimos una solicitud para restablecer la contraseña de tu cuenta.",
          `El enlace caduca en ${minutes} minutos y solo se puede usar una vez.`,
          "Si no lo pediste, ignora este correo: tu contraseña no cambia.",
        ];
  return {
    to,
    kind: "reset",
    subject: "Recupera tu contraseña · TuCatálogo",
    text: `${title}\n\n${intros.join("\n")}\n\n${url}\n`,
    html: renderHtml(title, intros, { label: "Cambiar contraseña", url }),
    resetUrl: url,
  };
}

class ConsoleEmailDriver implements EmailDriver {
  readonly name = "console" as const;

  async send(message: EmailMessage): Promise<void> {
    console.log(
      JSON.stringify({
        level: "info",
        emailDriver: "console",
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    );
  }
}

class MemoryEmailDriver implements EmailDriver {
  readonly name = "memory" as const;

  async send(message: EmailMessage): Promise<void> {
    // Nunca se registra en logs ni se persiste: solo memoria del isolate.
    emailOutbox.push(message);
    recordDevOutboxEntry({
      to: message.to,
      kind: message.kind,
      subject: message.subject,
      text: message.text,
      html: message.html,
      createdAt: new Date().toISOString(),
      ...(message.code ? { code: message.code } : {}),
      ...(message.resetUrl ? { resetUrl: message.resetUrl } : {}),
    });
  }
}

class ResendEmailDriver implements EmailDriver {
  readonly name = "resend" as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        JSON.stringify({
          level: "error",
          message: "Resend rechazó el envío",
          status: response.status,
          detail: detail.slice(0, 300),
        }),
      );
      throw new AppError("SERVICE_UNAVAILABLE", "No pudimos enviar el correo. Inténtalo de nuevo.");
    }
  }
}

/**
 * Driver según `EMAIL_DRIVER`. Si falta o es desconocido → 503 con log: nunca
 * se cae a `console` en un entorno desplegado.
 */
export function createEmailDriver(env: Env): EmailDriver {
  const driver = env.EMAIL_DRIVER;

  if (driver === "console") {
    // M4: `console` escribe el OTP/enlace en el log. Fuera de local eso sería
    // una filtración de credenciales en los logs del Worker, así que es un
    // fallo de configuración visible (503 + log), nunca un aviso.
    if (env.ENVIRONMENT !== "local") {
      console.error(
        JSON.stringify({
          level: "error",
          message: "EMAIL_DRIVER=console solo se permite en local",
          environment: env.ENVIRONMENT,
        }),
      );
      throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
    }
    return new ConsoleEmailDriver();
  }

  if (driver === "memory") {
    // El buzón vive en memoria del isolate: fuera de local los correos se
    // perderían en silencio, así que es un fallo de configuración visible.
    if (env.ENVIRONMENT !== "local") {
      console.error(
        JSON.stringify({
          level: "error",
          message: "EMAIL_DRIVER=memory solo se permite en local",
          environment: env.ENVIRONMENT,
        }),
      );
      throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
    }
    return new MemoryEmailDriver();
  }

  if (driver === "resend") {
    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM ?? env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "EMAIL_DRIVER=resend sin RESEND_API_KEY o remitente",
          hasApiKey: Boolean(apiKey),
          hasFrom: Boolean(from),
        }),
      );
      throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
    }
    return new ResendEmailDriver(apiKey, from);
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: "EMAIL_DRIVER ausente o desconocido",
      value: driver ?? null,
    }),
  );
  throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
}
