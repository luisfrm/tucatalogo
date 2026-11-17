import { describe, expect, it } from "vitest";

import { devOutboxSize } from "../src/libs/email";
import {
  api,
  extractResetToken,
  getJson,
  postJson,
  uniqueEmail,
  uniqueSlug,
  withEnv,
  type ApiErrorBody,
} from "./helpers";

const PASSWORD = "Contraseña123";

interface DevOutboxBody {
  to: string;
  kind: "otp" | "reset";
  subject: string;
  text: string;
  html: string;
  createdAt: string;
  code?: string;
  resetUrl?: string;
}

async function requestOtp(email: string, slug = uniqueSlug()): Promise<void> {
  const response = await postJson("/auth/store/signup/otp", {
    email,
    slug,
    turnstileToken: "test-token",
  });
  expect(response.status).toBe(202);
}

/** Alta completa de tienda, para poder probar el correo de reset. */
async function signupFully(email: string, slug: string): Promise<void> {
  await requestOtp(email, slug);
  const otp = (await (await getJson(`/dev/outbox?to=${encodeURIComponent(email)}`)).json()) as DevOutboxBody;
  const created = await postJson("/auth/store/signup", {
    name: "Dueña",
    email,
    password: PASSWORD,
    storeName: "Tienda",
    slug,
    currency: "USD",
    themeId: "rose",
    code: otp.code,
  });
  expect(created.status).toBe(201);
}

describe("GET /dev/outbox (local + memory)", () => {
  it("devuelve el último OTP del destinatario sin cachear", async () => {
    const email = uniqueEmail();
    await requestOtp(email);

    const response = await getJson(`/dev/outbox?to=${encodeURIComponent(email)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as DevOutboxBody;
    expect(body.to).toBe(email);
    expect(body.kind).toBe("otp");
    expect(body.subject).toContain("verificación");
    expect(body.html).toContain("<!doctype html>");
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
    expect(body.code).toMatch(/^\d{6}$/);
    expect(body.text).toContain(body.code!);
    expect(body.resetUrl).toBeUndefined();
  });

  it("normaliza el email y devuelve el enlace de reset", async () => {
    const email = uniqueEmail();
    const slug = uniqueSlug();
    await signupFully(email, slug);

    expect((await postJson("/auth/store/password/forgot", { email })).status).toBe(202);

    const response = await getJson(`/dev/outbox?to=${encodeURIComponent(`  ${email.toUpperCase()}  `)}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as DevOutboxBody;
    expect(body.kind).toBe("reset");
    expect(body.resetUrl).toContain(
      `http://${slug}.localhost:5173/panel-admin/reset-password?token=`,
    );
    expect(extractResetToken(body.text)).toBe(extractResetToken(body.resetUrl!));
    expect(body.code).toBeUndefined();
  });

  it("GET /dev/outbox/last devuelve el último correo global", async () => {
    const first = uniqueEmail("primero");
    const second = uniqueEmail("segundo");
    await requestOtp(first);
    await requestOtp(second);

    const response = await getJson("/dev/outbox/last");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as DevOutboxBody;
    expect(body.to).toBe(second);
    expect(body.code).toMatch(/^\d{6}$/);
  });

  it("404 si no hay correos para ese destinatario y 400 sin `to`", async () => {
    const unknown = await getJson(`/dev/outbox?to=${encodeURIComponent(uniqueEmail("nadie"))}`);
    expect(unknown.status).toBe(404);
    expect(((await unknown.json()) as ApiErrorBody).error.code).toBe("NOT_FOUND");

    const missing = await getJson("/dev/outbox");
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as ApiErrorBody).error).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("el OTP solo vive en el outbox: no viaja en la respuesta del endpoint", async () => {
    // Nota: el runtime de Workers no permite interceptar `console` desde el
    // test, así que la garantía "no se escribe en logs" se cubre en
    // `auth-config.test.ts` (el driver `console` no se construye fuera de
    // local) y aquí se comprueba que el código no sale por la respuesta HTTP.
    const email = uniqueEmail();
    const response = await postJson("/auth/store/signup/otp", {
      email,
      slug: uniqueSlug(),
      turnstileToken: "test-token",
    });
    expect(response.status).toBe(202);
    expect(await response.text()).not.toMatch(/\b\d{6}\b/);

    const entry = (await (await getJson(`/dev/outbox?to=${encodeURIComponent(email)}`)).json()) as DevOutboxBody;
    expect(entry.code).toMatch(/^\d{6}$/);
  });
});

describe("GET /dev/outbox fuera de local", () => {
  it("404 en development (no se ejecuta el driver)", async () => {
    const email = uniqueEmail();
    await withEnv({ ENVIRONMENT: "development" }, async () => {
      const byRecipient = await api(`/dev/outbox?to=${encodeURIComponent(email)}`);
      expect(byRecipient.status).toBe(404);
      expect(byRecipient.headers.get("cache-control")).toBe("no-store");

      const last = await api("/dev/outbox/last");
      expect(last.status).toBe(404);
    });
  });

  it("404 en production", async () => {
    await withEnv({ ENVIRONMENT: "production" }, async () => {
      expect((await api("/dev/outbox/last")).status).toBe(404);
      expect((await api(`/dev/outbox?to=${encodeURIComponent(uniqueEmail())}`)).status).toBe(404);
    });
  });

  it("404 en local si el driver no es memory", async () => {
    const email = uniqueEmail();
    await requestOtp(email);
    // El correo existe en el outbox, pero el modo ya no lo publica.
    await withEnv({ EMAIL_DRIVER: "console" }, async () => {
      const response = await api(`/dev/outbox?to=${encodeURIComponent(email)}`);
      expect(response.status).toBe(404);
    });
    expect(devOutboxSize()).toBeGreaterThan(0);
  });
});
