import { describe, expect, it } from "vitest";

import { hashIp } from "../src/libs/crypto";
import { findLastEmailTo } from "../src/libs/email";
import { testEnv } from "./env";
import {
  cookiePair,
  extractResetToken,
  getJson,
  hasCookie,
  hasLiveCookie,
  nextTestIp,
  postJson,
  setCookies,
  totp,
  totpSecretFromUri,
  uniqueEmail,
  type ApiErrorBody,
} from "./helpers";

const PASSWORD = "AdminContraseña1";

/** Estado limpio del reino console: `/init` es one-time por definición. */
async function resetConsoleState(): Promise<void> {
  await testEnv.DB.batch([
    testEnv.DB.prepare("DELETE FROM admin_two_factor"),
    testEnv.DB.prepare("DELETE FROM admin_sessions"),
    testEnv.DB.prepare("DELETE FROM admin_accounts"),
    testEnv.DB.prepare("DELETE FROM admin_verifications"),
    testEnv.DB.prepare("DELETE FROM admin_users"),
    testEnv.DB.prepare("DELETE FROM audit_log"),
    testEnv.DB.prepare("DELETE FROM rate_limit_counter"),
  ]);
}

interface InitResult {
  email: string;
  enrollmentToken: string;
  secret: string;
  backupCodes: string[];
}

/** `/init` completo: alta del admin + enrolamiento pendiente, **sin sesión**. */
async function initAdmin(email = uniqueEmail("admin")): Promise<InitResult> {
  const response = await postJson("/auth/console/init", {
    name: "Admin",
    email,
    password: PASSWORD,
  });
  expect(response.status).toBe(201);

  // M1: el alta no emite ninguna cookie de sesión.
  expect(hasLiveCookie(response, "console.session_token")).toBe(false);

  const body = (await response.json()) as {
    backupCodes: string[];
    totpUri: string;
    enrollmentRequired: boolean;
    enrollmentToken: string;
  };
  expect(body.enrollmentRequired).toBe(true);
  expect(body.backupCodes).toHaveLength(10);
  expect(body.enrollmentToken).toMatch(/^[0-9a-f]{64}$/);

  return {
    email,
    enrollmentToken: body.enrollmentToken,
    secret: totpSecretFromUri(body.totpUri),
    backupCodes: body.backupCodes,
  };
}

/** Verifica el TOTP del enrolamiento y devuelve la sesión ya verificada. */
async function completeEnrollment(enrollmentToken: string, secret: string): Promise<string> {
  const response = await postJson("/auth/console/2fa/verify", {
    code: await totp(secret),
    enrollmentToken,
  });
  expect(response.status).toBe(204);
  return cookiePair(response, "console.session_token");
}

async function loginConsole(email: string, password: string) {
  return postJson("/auth/console/login", { email, password });
}

describe("POST /auth/console/init", () => {
  it("informa si el alta está disponible y es one-time", async () => {
    await resetConsoleState();
    const before = await getJson("/auth/console/init-status");
    expect(await before.json()).toEqual({ available: true });

    await initAdmin();

    const after = await getJson("/auth/console/init-status");
    expect(await after.json()).toEqual({ available: false });

    const second = await postJson("/auth/console/init", {
      name: "Otro",
      email: uniqueEmail("otro"),
      password: PASSWORD,
    });
    expect(second.status).toBe(410);
    expect((await second.json()) as ApiErrorBody).toMatchObject({
      error: { code: "GONE", reason: "INIT_CONSUMED" },
    });
  });

  it("acepta el alta sin credencial compartida", async () => {
    await resetConsoleState();
    const email = uniqueEmail("admin");

    // `/init` ya no recibe token: la barrera externa es Cloudflare Access.
    const response = await postJson("/auth/console/init", {
      name: "Admin",
      email,
      password: PASSWORD,
    });
    expect(response.status).toBe(201);
    expect(hasLiveCookie(response, "console.session_token")).toBe(false);

    const body = (await response.json()) as {
      backupCodes: string[];
      totpUri: string;
      enrollmentRequired: boolean;
      enrollmentToken: string;
    };
    expect(body.enrollmentRequired).toBe(true);
    expect(body.backupCodes).toHaveLength(10);
    expect(body.totpUri.startsWith("otpauth://totp/")).toBe(true);
    expect(body.enrollmentToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("responde 410 cuando ya hay admin", async () => {
    await resetConsoleState();
    await initAdmin();
    const response = await postJson("/auth/console/init", {
      name: "Otro",
      email: uniqueEmail("otro"),
      password: PASSWORD,
    });
    expect(response.status).toBe(410);
    expect((await response.json()) as ApiErrorBody).toMatchObject({
      error: { code: "GONE", reason: "INIT_CONSUMED" },
    });
  });

  it("limita el alta por IP (5/h) y no crea admins al agotarse", async () => {
    await resetConsoleState();
    const ip = nextTestIp();
    const bucket = `consoleInitByIp:${await hashIp(
      testEnv.BETTER_AUTH_SECRET_CONSOLE!,
      ip,
    )}`;
    const now = Date.now();
    await testEnv.DB.prepare(
      "INSERT INTO rate_limit_counter (bucket, count, window_started_at, expires_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(bucket, 5, now, now + 60_000, now)
      .run();

    const blocked = await postJson(
      "/auth/console/init",
      { name: "Admin", email: uniqueEmail("admin"), password: PASSWORD },
      { "x-client-ip": ip },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();

    const total = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM admin_users").first<{
      total: number;
    }>();
    expect(total?.total).toBe(0);
  });

  it("crea el admin con 2FA pendiente, sin sesión y con audit", async () => {
    await resetConsoleState();
    const { email } = await initAdmin();

    const admin = await testEnv.DB.prepare(
      "SELECT two_factor_enabled, email_verified FROM admin_users WHERE email = ?",
    )
      .bind(email)
      .first<{ two_factor_enabled: number; email_verified: number }>();
    expect(admin).toMatchObject({ two_factor_enabled: 0, email_verified: 1 });

    const twoFactor = await testEnv.DB.prepare(
      "SELECT verified FROM admin_two_factor",
    ).first<{ verified: number }>();
    expect(twoFactor?.verified).toBe(0);

    // M1: la sesión transitoria del enrolamiento no queda viva en D1.
    const sessions = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM admin_sessions",
    ).first<{ total: number }>();
    expect(sessions?.total).toBe(0);

    const audit = await testEnv.DB.prepare(
      "SELECT actor_type, action, metadata FROM audit_log WHERE action = 'admin.init'",
    ).first<{ actor_type: string; action: string; metadata: string | null }>();
    expect(audit).toMatchObject({ actor_type: "admin", action: "admin.init" });
    expect(audit?.metadata ?? "").not.toContain(email);
  });
});

describe("M1: ninguna sesión antes de verificar el TOTP", () => {
  it("no abre el console con la respuesta de /init ni con el enrollmentToken", async () => {
    await resetConsoleState();
    const { enrollmentToken } = await initAdmin();

    // Sin cookie: no hay sesión.
    expect((await getJson("/console/stores")).status).toBe(401);

    // Usar el challenge como si fuera una cookie de sesión tampoco sirve.
    const forged = await getJson("/console/stores", {
      cookie: `console.session_token=${enrollmentToken}`,
    });
    expect(forged.status).toBe(401);

    // El challenge tampoco vale como cookie `two_factor`.
    const asChallenge = await getJson("/console/stores", {
      cookie: `console.two_factor=${enrollmentToken}`,
    });
    expect(asChallenge.status).toBe(401);
  });

  it("no abre el console con la respuesta de /2fa/setup", async () => {
    await resetConsoleState();
    const { email } = await initAdmin();

    const setup = await postJson("/auth/console/2fa/setup", { email, password: PASSWORD });
    expect(setup.status).toBe(200);
    expect(hasLiveCookie(setup, "console.session_token")).toBe(false);

    const body = (await setup.json()) as { enrollmentToken: string; totpUri: string };
    expect(body.enrollmentToken).toMatch(/^[0-9a-f]{64}$/);

    expect((await getJson("/console/stores")).status).toBe(401);
    expect(
      (await getJson("/console/stores", { cookie: `console.session_token=${body.enrollmentToken}` }))
        .status,
    ).toBe(401);

    // El token nuevo sí permite completar el enrolamiento.
    const sessionCookie = await completeEnrollment(
      body.enrollmentToken,
      totpSecretFromUri(body.totpUri),
    );
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);
  });

  it("abre el console solo tras /2fa/verify", async () => {
    await resetConsoleState();
    const { enrollmentToken, secret } = await initAdmin();

    expect((await getJson("/console/stores")).status).toBe(401);

    const sessionCookie = await completeEnrollment(enrollmentToken, secret);
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);

    const verified = await testEnv.DB.prepare(
      "SELECT verified FROM admin_two_factor",
    ).first<{ verified: number }>();
    expect(verified?.verified).toBe(1);
    const enabled = await testEnv.DB.prepare(
      "SELECT two_factor_enabled FROM admin_users",
    ).first<{ two_factor_enabled: number }>();
    expect(enabled?.two_factor_enabled).toBe(1);
  });

  it("rechaza una sesión cuyo 2FA no está verificado en D1", async () => {
    await resetConsoleState();
    const { enrollmentToken, secret } = await initAdmin();
    const sessionCookie = await completeEnrollment(enrollmentToken, secret);
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);

    // Aunque `two_factor_enabled` siga a 1, la fila de 2FA manda (M1).
    await testEnv.DB.prepare("UPDATE admin_two_factor SET verified = 0").run();

    const blocked = await getJson("/console/stores", { cookie: sessionCookie });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "TWO_FACTOR_REQUIRED" },
    });

    await testEnv.DB.prepare("UPDATE admin_two_factor SET verified = 1").run();
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);
  });

  it("el enrollmentToken es de un solo uso", async () => {
    await resetConsoleState();
    const { enrollmentToken, secret } = await initAdmin();
    await completeEnrollment(enrollmentToken, secret);

    const reuse = await postJson("/auth/console/2fa/verify", {
      code: await totp(secret),
      enrollmentToken,
    });
    expect(reuse.status).toBe(401);
    expect((await reuse.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "ENROLLMENT_TOKEN_INVALID" },
    });
  });
});

describe("2FA del console", () => {
  it("completa el enrolamiento y abre la sesión", async () => {
    await resetConsoleState();
    const { enrollmentToken, secret } = await initAdmin();

    const wrong = await postJson("/auth/console/2fa/verify", {
      code: "000000",
      enrollmentToken,
    });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "TWO_FACTOR_INVALID" },
    });
    // Un intento fallido no deja sesiones vivas.
    const sessions = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM admin_sessions",
    ).first<{ total: number }>();
    expect(sessions?.total).toBe(0);

    const sessionCookie = await completeEnrollment(enrollmentToken, secret);

    const session = await getJson("/auth/console/session", { cookie: sessionCookie });
    expect(session.status).toBe(200);
    const body = (await session.json()) as {
      admin: { email: string; twoFactorEnabled: boolean };
      expiresAt: string;
    };
    expect(body.admin.twoFactorEnabled).toBe(true);
    expect(body.expiresAt).toBeTruthy();
  });

  it("exige código tras la contraseña en cada login y acepta backup codes una sola vez", async () => {
    await resetConsoleState();
    const { email, enrollmentToken, secret, backupCodes } = await initAdmin();
    await completeEnrollment(enrollmentToken, secret);

    const challenge = await loginConsole(email, PASSWORD);
    expect(challenge.status).toBe(200);
    const challengeBody = (await challenge.json()) as {
      twoFactorRequired: boolean;
      enrollmentRequired: boolean;
    };
    expect(challengeBody).toMatchObject({ twoFactorRequired: true, enrollmentRequired: false });
    expect(hasLiveCookie(challenge, "console.session_token")).toBe(false);

    const challengeCookie = cookiePair(challenge, "console.two_factor");
    const backupCode = backupCodes[0]!;

    const verified = await postJson(
      "/auth/console/2fa/verify",
      { code: backupCode, type: "backup" },
      { cookie: challengeCookie },
    );
    expect(verified.status).toBe(204);
    const sessionCookie = cookiePair(verified, "console.session_token");
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);

    // El backup code ya se consumió.
    const reuseChallenge = await loginConsole(email, PASSWORD);
    const reuseCookie = cookiePair(reuseChallenge, "console.two_factor");
    const reuse = await postJson(
      "/auth/console/2fa/verify",
      { code: backupCode, type: "backup" },
      { cookie: reuseCookie },
    );
    expect(reuse.status).toBe(401);
  });

  it("no permite re-enrolar cuando el 2FA ya está verificado", async () => {
    await resetConsoleState();
    const { email, enrollmentToken, secret } = await initAdmin();
    await completeEnrollment(enrollmentToken, secret);

    const setup = await postJson("/auth/console/2fa/setup", { email, password: PASSWORD });
    expect(setup.status).toBe(409);
    expect((await setup.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "TWO_FACTOR_ALREADY_ENABLED" },
    });
  });
});

describe("login de console", () => {
  it("rechaza credenciales incorrectas con el mismo mensaje", async () => {
    await resetConsoleState();
    const { email } = await initAdmin();

    const wrong = await loginConsole(email, "OtraContraseña9");
    expect(wrong.status).toBe(401);
    expect((await wrong.json()) as ApiErrorBody).toMatchObject({
      error: { code: "UNAUTHORIZED", reason: "INVALID_CREDENTIALS" },
    });
    expect(hasCookie(wrong, "console.session_token")).toBe(false);

    const unknown = await loginConsole(uniqueEmail("nadie"), PASSWORD);
    expect(unknown.status).toBe(401);
    expect((await unknown.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "INVALID_CREDENTIALS" },
    });
  });

  it("antes de verificar el 2FA devuelve un challenge propio, no una sesión", async () => {
    await resetConsoleState();
    const { email, secret } = await initAdmin();

    const response = await loginConsole(email, PASSWORD);
    expect(response.status).toBe(200);
    expect(hasLiveCookie(response, "console.session_token")).toBe(false);

    const body = (await response.json()) as {
      twoFactorRequired: boolean;
      enrollmentRequired: boolean;
      enrollmentToken?: string;
    };
    expect(body).toMatchObject({ twoFactorRequired: true, enrollmentRequired: true });
    expect(body.enrollmentToken).toMatch(/^[0-9a-f]{64}$/);

    // Better Auth había creado sesión para el password: no debe quedar viva.
    const sessions = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM admin_sessions",
    ).first<{ total: number }>();
    expect(sessions?.total).toBe(0);

    const sessionCookie = await completeEnrollment(body.enrollmentToken!, secret);
    expect((await getJson("/console/stores", { cookie: sessionCookie })).status).toBe(200);
  });

  it("limita los intentos de login por IP y email", async () => {
    await resetConsoleState();
    const { email } = await initAdmin();
    const ip = nextTestIp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postJson(
        "/auth/console/login",
        { email, password: "MalaContraseña1" },
        { "x-client-ip": ip },
      );
      expect(response.status).toBe(401);
    }

    const blocked = await postJson(
      "/auth/console/login",
      { email, password: "MalaContraseña1" },
      { "x-client-ip": ip },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("no acepta la cookie de tienda en el reino console", async () => {
    await resetConsoleState();
    const response = await getJson("/auth/console/session", {
      cookie: "store.session_token=falso",
    });
    expect(response.status).toBe(401);
  });

  it("cierra sesión e invalida la fila en D1", async () => {
    await resetConsoleState();
    const { enrollmentToken, secret } = await initAdmin();
    const sessionCookie = await completeEnrollment(enrollmentToken, secret);

    const logout = await postJson("/auth/console/logout", {}, { cookie: sessionCookie });
    expect(logout.status).toBe(204);
    expect(setCookies(logout).length).toBeGreaterThan(0);

    expect((await getJson("/auth/console/session", { cookie: sessionCookie })).status).toBe(401);

    const sessions = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM admin_sessions").first<{
      total: number;
    }>();
    expect(sessions?.total).toBe(0);
  });
});

describe("auditoría de login del console (B5)", () => {
  it("registra admin.login y admin.login_failed con ip_hash y sin credenciales", async () => {
    await resetConsoleState();
    const { email, enrollmentToken, secret } = await initAdmin();

    // Fallo de contraseña.
    const failed = await postJson(
      "/auth/console/login",
      { email, password: "MalaContraseña2" },
      { "x-client-ip": "203.0.113.77" },
    );
    expect(failed.status).toBe(401);

    const failedRow = await testEnv.DB.prepare(
      "SELECT actor_type, actor_id, action, metadata, ip_hash FROM audit_log WHERE action = 'admin.login_failed'",
    ).first<{
      actor_type: string;
      actor_id: string | null;
      metadata: string | null;
      ip_hash: string | null;
    }>();
    expect(failedRow).toBeTruthy();
    expect(failedRow?.actor_type).toBe("admin");
    expect(failedRow?.ip_hash).toBeTruthy();
    expect(failedRow?.metadata).toContain('"stage":"password"');
    expect(failedRow?.metadata ?? "").not.toContain(email);
    expect(failedRow?.metadata ?? "").not.toContain("MalaContraseña2");

    // Login completo (enrolamiento) → admin.login.
    await completeEnrollment(enrollmentToken, secret);
    const loginRow = await testEnv.DB.prepare(
      "SELECT actor_id, action, metadata, ip_hash FROM audit_log WHERE action = 'admin.login'",
    ).first<{ actor_id: string | null; metadata: string | null; ip_hash: string | null }>();
    expect(loginRow).toBeTruthy();
    expect(loginRow?.actor_id).toBeTruthy();
    expect(loginRow?.ip_hash).toBeTruthy();
    expect(loginRow?.metadata).toContain('"enrollment":true');
    expect(loginRow?.metadata ?? "").not.toContain(email);

    // Ningún intento de tienda se audita aquí.
    const storeRows = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM audit_log WHERE action LIKE 'admin.login%' AND actor_type = 'owner'",
    ).first<{ total: number }>();
    expect(storeRows?.total).toBe(0);
  });
});

describe("recuperación de contraseña del console", () => {
  it("responde igual exista o no el email", async () => {
    await resetConsoleState();
    const { email } = await initAdmin();

    const known = await postJson("/auth/console/password/forgot", { email });
    expect(known.status).toBe(202);
    const unknown = await postJson("/auth/console/password/forgot", {
      email: uniqueEmail("nadie"),
    });
    expect(unknown.status).toBe(202);
    expect(await unknown.json()).toEqual({ ok: true });

    const message = findLastEmailTo(email);
    expect(message?.text).toContain("http://localhost:5175/reset-password?token=");
  });

  it("cambia la contraseña sin saltar el 2FA", async () => {
    await resetConsoleState();
    const { email, enrollmentToken, secret } = await initAdmin();
    const sessionCookie = await completeEnrollment(enrollmentToken, secret);

    expect((await postJson("/auth/console/password/forgot", { email })).status).toBe(202);
    const token = extractResetToken(findLastEmailTo(email)!.text);

    const reset = await postJson("/auth/console/password/reset", {
      token,
      password: "NuevaAdminPass2",
    });
    expect(reset.status).toBe(204);

    // El reset revoca las sesiones anteriores.
    expect((await getJson("/auth/console/session", { cookie: sessionCookie })).status).toBe(401);

    // La contraseña nueva no da sesión por sí sola: sigue exigiendo TOTP.
    const challenge = await loginConsole(email, "NuevaAdminPass2");
    expect(challenge.status).toBe(200);
    expect((await challenge.json()) as { twoFactorRequired: boolean }).toMatchObject({
      twoFactorRequired: true,
    });
    expect(hasLiveCookie(challenge, "console.session_token")).toBe(false);

    const challengeCookie = cookiePair(challenge, "console.two_factor");
    const verified = await postJson(
      "/auth/console/2fa/verify",
      { code: await totp(secret) },
      { cookie: challengeCookie },
    );
    expect(verified.status).toBe(204);
    expect(
      (await getJson("/console/stores", { cookie: cookiePair(verified, "console.session_token") }))
        .status,
    ).toBe(200);

    // La contraseña anterior ya no sirve.
    expect((await loginConsole(email, PASSWORD)).status).toBe(401);
  });

  it("rechaza un token de reset inválido y limita los intentos por IP (B4)", async () => {
    await resetConsoleState();
    await initAdmin();
    const ip = nextTestIp();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postJson(
        "/auth/console/password/reset",
        { token: `inventado-${attempt}`, password: "OtraClave123" },
        { "x-client-ip": ip },
      );
      expect(response.status).toBe(400);
      expect((await response.json()) as ApiErrorBody).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    }

    const blocked = await postJson(
      "/auth/console/password/reset",
      { token: "inventado-final", password: "OtraClave123" },
      { "x-client-ip": ip },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
