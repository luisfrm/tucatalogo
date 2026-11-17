import { describe, expect, it } from "vitest";

import type {
  ConsoleInitInput,
  ConsoleInitResponse,
  ConsoleLoginResponse,
  TwoFactorSetupResponse,
} from "@tucatalogo/types";

import { createApiClient, type ApiClient } from "../src/client";
import {
  ApiClientError,
  initConsole,
  loginConsole,
  setupConsoleTwoFactor,
  verifyConsoleTwoFactor,
} from "../src/domain";

const CONTEXT = { cookie: "console.two_factor=challenge" };

interface Captured {
  url: string;
  method: string;
  body: unknown;
}

interface StubSpec {
  status?: number;
  body?: unknown;
  setCookie?: string[];
}

/** Cliente real (transporte local) con `fetch` sustituido: sin red. */
function stubApi(specs: StubSpec[]): { api: ApiClient; calls: Captured[] } {
  const base = createApiClient({ API_INTERNAL_URL: "http://127.0.0.1:9797" });
  const calls: Captured[] = [];
  let index = 0;

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body,
    });

    const spec = specs[index] ?? { status: 500 };
    index += 1;

    const headers = new Headers({ "content-type": "application/json" });
    for (const cookie of spec.setCookie ?? []) headers.append("set-cookie", cookie);

    const hasBody = spec.body !== undefined && spec.status !== 204;
    return new Response(hasBody ? JSON.stringify(spec.body) : null, {
      status: spec.status ?? 200,
      headers,
    });
  }) as typeof fetch;

  return { api: { ...base, fetch: fetchStub }, calls };
}

describe("console auth (M1)", () => {
  it("initConsole devuelve el payload con enrollmentToken y no promete sesión", async () => {
    const response: ConsoleInitResponse = {
      admin: { id: "admin-1", name: "Admin", email: "admin@example.com" },
      backupCodes: ["code-1", "code-2"],
      totpUri: "otpauth://totp/TuCatalogo:admin@example.com?secret=ABC",
      enrollmentRequired: true,
      enrollmentToken: "enroll-token",
    };
    const { api, calls } = stubApi([{ status: 201, body: response }]);

    const input: ConsoleInitInput = {
      initToken: "init-token",
      name: "Admin",
      email: "admin@example.com",
      password: "Contraseña123",
    };
    const result = await initConsole(api, input);

    expect(result).toEqual(response);
    // No hay envoltorio de cookies: `/init` no abre sesión.
    expect("setCookies" in result).toBe(false);
    expect(calls[0]).toMatchObject({
      url: "http://127.0.0.1:9797/auth/console/init",
      method: "POST",
      body: input,
    });
  });

  it("loginConsole devuelve el challenge de enrolamiento sin cookies", async () => {
    const response: ConsoleLoginResponse = {
      admin: { id: "admin-1", name: "Admin", email: "admin@example.com" },
      twoFactorRequired: true,
      enrollmentRequired: true,
      enrollmentToken: "enroll-token",
    };
    const { api, calls } = stubApi([{ body: response }]);

    const result = await loginConsole(api, {
      email: "admin@example.com",
      password: "Contraseña123",
    });

    expect(result).toEqual({
      admin: response.admin,
      twoFactorRequired: true,
      enrollmentRequired: true,
      enrollmentToken: "enroll-token",
      setCookies: [],
    });
    expect(calls[0]?.url).toBe("http://127.0.0.1:9797/auth/console/login");
  });

  it("loginConsole con 2FA ya activo reenvía solo la cookie del challenge", async () => {
    const response: ConsoleLoginResponse = {
      admin: null,
      twoFactorRequired: true,
      enrollmentRequired: false,
    };
    const { api } = stubApi([
      {
        body: response,
        setCookie: ["console.two_factor=challenge-value; Path=/; HttpOnly; SameSite=Lax"],
      },
    ]);

    const result = await loginConsole(api, {
      email: "admin@example.com",
      password: "Contraseña123",
    });

    expect(result).toMatchObject({
      admin: null,
      twoFactorRequired: true,
      enrollmentRequired: false,
    });
    expect(result.enrollmentToken).toBeUndefined();
    expect(result.setCookies).toHaveLength(1);
    expect(result.setCookies[0]).toContain("console.two_factor=challenge-value");
  });

  it("setupConsoleTwoFactor exige email+password y devuelve payload + cookies", async () => {
    const response: TwoFactorSetupResponse = {
      totpUri: "otpauth://totp/TuCatalogo:admin@example.com?secret=XYZ",
      backupCodes: ["code-1", "code-2"],
      enrollmentToken: "enroll-token",
    };
    const { api, calls } = stubApi([{ body: response }]);

    const result = await setupConsoleTwoFactor(
      api,
      { email: "admin@example.com", password: "Contraseña123" },
      CONTEXT,
    );

    expect(result).toEqual({ ...response, setCookies: [] });
    expect(calls[0]).toMatchObject({
      url: "http://127.0.0.1:9797/auth/console/2fa/setup",
      method: "POST",
      body: { email: "admin@example.com", password: "Contraseña123" },
    });
  });

  it("verifyConsoleTwoFactor acepta enrollmentToken y devuelve la cookie de sesión", async () => {
    const { api, calls } = stubApi([
      {
        status: 204,
        setCookie: ["console.session_token=session-value; Path=/; HttpOnly; SameSite=Lax"],
      },
    ]);

    const result = await verifyConsoleTwoFactor(
      api,
      { code: "123456", type: "totp", enrollmentToken: "enroll-token" },
      { cookie: "console.two_factor=challenge" },
    );

    expect(result.setCookies[0]).toContain("console.session_token=session-value");
    expect(calls[0]).toMatchObject({
      url: "http://127.0.0.1:9797/auth/console/2fa/verify",
      method: "POST",
      body: { code: "123456", type: "totp", enrollmentToken: "enroll-token" },
    });
  });

  it("verifyConsoleTwoFactor con backup no inventa enrollmentToken", async () => {
    const { api, calls } = stubApi([{ status: 204 }]);

    await verifyConsoleTwoFactor(api, { code: "backup-code", type: "backup" }, CONTEXT);

    expect(calls[0]?.body).toEqual({ code: "backup-code", type: "backup" });
  });

  it("propaga el envelope de error con reason", async () => {
    const { api } = stubApi([
      {
        status: 401,
        body: {
          error: {
            code: "UNAUTHORIZED",
            message: "El código no es válido.",
            reason: "TWO_FACTOR_INVALID",
            requestId: "req-1",
          },
        },
      },
    ]);

    const error = await verifyConsoleTwoFactor(
      api,
      { code: "000000", type: "totp", enrollmentToken: "enroll-token" },
      CONTEXT,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      reason: "TWO_FACTOR_INVALID",
      requestId: "req-1",
    });
  });
});
