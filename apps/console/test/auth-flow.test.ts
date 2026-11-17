import { ApiClientError } from "@tucatalogo/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Flujo de autenticación del console (M1).
 *
 * Las actions se prueban con el API mockeado: aquí se comprueba el contrato de
 * la UI (qué cookies reenvía y cuáles no), no la verificación TOTP real, que
 * vive y se testea en `apps/api`.
 */
const apiMocks = vi.hoisted(() => ({
  initConsole: vi.fn(),
  loginConsole: vi.fn(),
  setupConsoleTwoFactor: vi.fn(),
  verifyConsoleTwoFactor: vi.fn(),
  readConsoleSession: vi.fn(),
}));

vi.mock("@tucatalogo/api-client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, ...apiMocks };
});

vi.mock("../app/lib/api.server", () => ({
  getApi: () => ({}),
  apiContext: (request: Request) => ({
    cookie: request.headers.get("cookie") ?? undefined,
  }),
}));

import { action as initAction } from "../app/routes/init";
import { action as loginAction } from "../app/routes/login";
import { loader as storesLoader } from "../app/routes/stores-list";
import { action as twoFactorAction } from "../app/routes/two-factor";

type Action = (args: { request: Request }) => Promise<unknown>;

interface Unwrapped {
  status: number;
  headers: Headers;
  data: unknown;
  response: Response | null;
}

function post(entries: Record<string, string>, path = "/"): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return new Request(`http://console.test${path}`, { method: "POST", body: form });
}

async function runAction(action: unknown, request: Request): Promise<Unwrapped> {
  return unwrap(await (action as Action)({ request }));
}

async function runLoader(loader: unknown, request: Request): Promise<Unwrapped> {
  try {
    return unwrap(await (loader as Action)({ request }));
  } catch (error) {
    if (error instanceof Response) return unwrap(error);
    throw error;
  }
}

function unwrap(result: unknown): Unwrapped {
  if (result instanceof Response) {
    return { status: result.status, headers: result.headers, data: null, response: result };
  }

  const candidate = result as { data?: unknown; init?: ResponseInit };
  return {
    status: candidate.init?.status ?? 200,
    headers: new Headers(candidate.init?.headers),
    data: candidate.data ?? null,
    response: null,
  };
}

const INIT_FORM = {
  initToken: "init-token",
  name: "Admin QA",
  email: "admin@example.test",
  password: "ClaveLarga2026!",
  confirmPassword: "ClaveLarga2026!",
};

const LOGIN_FORM = {
  email: "admin@example.test",
  password: "ClaveLarga2026!",
};

const SETUP_RESPONSE = {
  totpUri: "otpauth://totp/TuCatalogo:admin@example.test?secret=ABC",
  backupCodes: ["code-1", "code-2"],
  enrollmentToken: "enr-setup",
  setCookies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/init (M1)", () => {
  it("no reenvía ninguna cookie de sesión y devuelve el enrollmentToken", async () => {
    apiMocks.initConsole.mockResolvedValue({
      admin: { id: "admin-1", name: "Admin QA", email: "admin@example.test" },
      backupCodes: ["code-1", "code-2"],
      totpUri: SETUP_RESPONSE.totpUri,
      enrollmentRequired: true,
      enrollmentToken: "enr-init",
    });

    const result = await runAction(initAction, post(INIT_FORM, "/init"));

    expect(result.status).toBe(200);
    expect(result.headers.getSetCookie()).toEqual([]);
    expect(result.data).toMatchObject({
      ok: true,
      enrollmentToken: "enr-init",
      totpUri: SETUP_RESPONSE.totpUri,
    });
  });

  it("devuelve el token para el formulario POST a /2fa (sin sesión)", async () => {
    apiMocks.initConsole.mockResolvedValue({
      admin: { id: "admin-1", name: "Admin QA", email: "admin@example.test" },
      backupCodes: ["code-1"],
      totpUri: SETUP_RESPONSE.totpUri,
      enrollmentRequired: true,
      enrollmentToken: "enr-init",
    });

    const result = await runAction(initAction, post(INIT_FORM, "/init"));

    expect(result.headers.getSetCookie()).toEqual([]);
    expect(result.data).toMatchObject({ ok: true, enrollmentToken: "enr-init" });
  });
});

describe("/login (M1)", () => {
  it("con 2FA activo solo reenvía el challenge, nunca la sesión", async () => {
    apiMocks.loginConsole.mockResolvedValue({
      admin: null,
      twoFactorRequired: true,
      enrollmentRequired: false,
      setCookies: [
        "console.two_factor=challenge; Path=/; HttpOnly; SameSite=Lax",
        "console.session_token=NO_DEBE_SALIR; Path=/; HttpOnly",
      ],
    });

    const result = await runAction(loginAction, post(LOGIN_FORM, "/login"));

    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("/2fa");
    const cookies = result.headers.getSetCookie();
    expect(cookies.some((cookie) => cookie.startsWith("console.two_factor="))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("console.session_token="))).toBe(false);
  });

  it("con enrolamiento pendiente pide /2fa/setup sin sesión y muestra la URI", async () => {
    apiMocks.loginConsole.mockResolvedValue({
      admin: { id: "admin-1", name: "Admin QA", email: "admin@example.test" },
      twoFactorRequired: true,
      enrollmentRequired: true,
      enrollmentToken: "enr-login",
      setCookies: [],
    });
    apiMocks.setupConsoleTwoFactor.mockResolvedValue(SETUP_RESPONSE);

    const result = await runAction(loginAction, post(LOGIN_FORM, "/login"));

    expect(result.status).toBe(200);
    expect(result.headers.getSetCookie()).toEqual([]);
    expect(apiMocks.setupConsoleTwoFactor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: LOGIN_FORM.email, password: LOGIN_FORM.password }),
      expect.anything(),
    );
    expect(result.data).toMatchObject({
      ok: true,
      mode: "enroll",
      enrollmentToken: "enr-setup",
      totpUri: SETUP_RESPONSE.totpUri,
    });
  });
});

describe("/2fa/verify (M1)", () => {
  it("el setup pide email+contraseña, devuelve token y no emite cookies", async () => {
    apiMocks.setupConsoleTwoFactor.mockResolvedValue(SETUP_RESPONSE);

    const result = await runAction(
      twoFactorAction,
      post(
        { intent: "setup", email: LOGIN_FORM.email, password: LOGIN_FORM.password },
        "/2fa",
      ),
    );

    expect(apiMocks.setupConsoleTwoFactor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: LOGIN_FORM.email, password: LOGIN_FORM.password }),
      expect.anything(),
    );
    expect(result.status).toBe(200);
    expect(result.headers.getSetCookie()).toEqual([]);
    expect(result.data).toMatchObject({
      ok: true,
      intent: "setup",
      enrollmentToken: "enr-setup",
    });
  });

  it("verifica con enrollmentToken y relaya la cookie de sesión", async () => {
    apiMocks.verifyConsoleTwoFactor.mockResolvedValue({
      setCookies: ["console.session_token=session; Path=/; HttpOnly; SameSite=Lax"],
    });

    const result = await runAction(
      twoFactorAction,
      post(
        { intent: "verify", type: "totp", code: "123456", enrollmentToken: "enr-1" },
        "/2fa",
      ),
    );

    expect(apiMocks.verifyConsoleTwoFactor).toHaveBeenCalledWith(
      expect.anything(),
      { code: "123456", type: "totp", enrollmentToken: "enr-1" },
      expect.anything(),
    );
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("/");
    expect(
      result.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("console.session_token=")),
    ).toBe(true);
  });

  it("un código erróneo no emite cookie y conserva el token para reintentar", async () => {
    apiMocks.verifyConsoleTwoFactor.mockRejectedValueOnce(
      new ApiClientError(
        401,
        "UNAUTHORIZED",
        "El código de verificación no es válido.",
        "TWO_FACTOR_INVALID",
      ),
    );

    const form = {
      intent: "verify",
      type: "totp",
      code: "000000",
      enrollmentToken: "enr-retry",
    };
    const failed = await runAction(twoFactorAction, post(form, "/2fa"));

    expect(failed.status).toBe(400);
    expect(failed.headers.getSetCookie()).toEqual([]);
    expect(failed.data).toMatchObject({ ok: false, enrollmentToken: "enr-retry" });

    apiMocks.verifyConsoleTwoFactor.mockResolvedValueOnce({
      setCookies: ["console.session_token=session; Path=/; HttpOnly; SameSite=Lax"],
    });
    const retried = await runAction(twoFactorAction, post(form, "/2fa"));

    expect(apiMocks.verifyConsoleTwoFactor).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ enrollmentToken: "enr-retry" }),
      expect.anything(),
    );
    expect(retried.status).toBe(302);
  });

  it("no permite backup code durante el enrolamiento", async () => {
    const result = await runAction(
      twoFactorAction,
      post(
        { intent: "verify", type: "backup", code: "backup-code", enrollmentToken: "enr-1" },
        "/2fa",
      ),
    );

    expect(result.status).toBe(400);
    expect(apiMocks.verifyConsoleTwoFactor).not.toHaveBeenCalled();
  });

  it("si el token de enrolamiento caducó, no lo reutiliza", async () => {
    apiMocks.verifyConsoleTwoFactor.mockRejectedValue(
      new ApiClientError(
        401,
        "UNAUTHORIZED",
        "El proceso de alta del 2FA caducó. Vuelve a empezar.",
        "ENROLLMENT_TOKEN_INVALID",
      ),
    );

    const result = await runAction(
      twoFactorAction,
      post(
        { intent: "verify", type: "totp", code: "123456", enrollmentToken: "enr-caducado" },
        "/2fa",
      ),
    );

    expect(result.status).toBe(400);
    expect(result.headers.getSetCookie()).toEqual([]);
    expect(result.data).toMatchObject({ ok: false, intent: "verify" });
    expect((result.data as { enrollmentToken?: string }).enrollmentToken).toBeUndefined();
  });

  it("sin cookie de sesión no se puede abrir el listado de tiendas", async () => {
    apiMocks.readConsoleSession.mockRejectedValue(
      new ApiClientError(401, "UNAUTHORIZED", "Inicia sesión para continuar."),
    );

    const request = new Request("http://console.test/", {
      headers: { cookie: "console.enrollment_token=enr-1" },
    });
    const response = await runLoader(storesLoader, request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
  });
});
