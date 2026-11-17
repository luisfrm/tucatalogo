import { testEnv } from "./env";
import { describe, expect, it } from "vitest";

import { emailOutbox, findLastEmailTo } from "../src/libs/email";
import {
  cookiePair,
  extractOtp,
  extractResetToken,
  getJson,
  hasCookie,
  nextTestIp,
  postJson,
  setCookies,
  uniqueEmail,
  uniqueSlug,
  type ApiErrorBody,
} from "./helpers";

const PASSWORD = "Contraseña123";

interface SignupOptions {
  themeId?: string;
  currency?: string;
  email?: string;
  slug?: string;
}

async function requestOtp(email: string, slug: string, ip = nextTestIp()) {
  return postJson(
    "/auth/store/signup/otp",
    { email, slug, turnstileToken: "test-token" },
    { "x-client-ip": ip },
  );
}

/** Registro completo contra el API. Devuelve todo lo útil para asserts. */
async function signup(options: SignupOptions = {}) {
  const email = options.email ?? uniqueEmail();
  const slug = options.slug ?? uniqueSlug();

  const otpResponse = await requestOtp(email, slug);
  expect(otpResponse.status).toBe(202);

  const message = findLastEmailTo(email);
  expect(message).toBeTruthy();
  const code = extractOtp(message!.text);

  const response = await postJson("/auth/store/signup", {
    name: "Dueña Ejemplo",
    email,
    password: PASSWORD,
    storeName: "Tienda Ejemplo",
    slug,
    currency: options.currency ?? "USD",
    themeId: options.themeId ?? "rose",
    code,
  });

  return { email, slug, code, response };
}

async function login(email: string, password: string, slug: string, ip = nextTestIp()) {
  return postJson(
    "/auth/store/login",
    { email, password },
    { "x-store-slug": slug, "x-client-ip": ip },
  );
}

describe("GET /auth/store/slug-check", () => {
  it("informa formato, reservados y disponibilidad", async () => {
    const available = await getJson("/auth/store/slug-check?slug=Mi-Tienda");
    expect(available.status).toBe(200);
    const body = (await available.json()) as {
      slug: string;
      available: boolean;
      reason: string | null;
      links: { storefront: string } | null;
    };
    expect(body).toMatchObject({ slug: "mi-tienda", available: true, reason: null });
    expect(body.links?.storefront).toBe("http://mi-tienda.localhost:5173");

    const reserved = await getJson("/auth/store/slug-check?slug=www");
    expect(await reserved.json()).toMatchObject({ available: false, reason: "reserved" });

    const badFormat = await getJson("/auth/store/slug-check?slug=-mal-");
    expect(await badFormat.json()).toMatchObject({ available: false, reason: "format" });

    const empty = await getJson("/auth/store/slug-check?slug=");
    expect(empty.status).toBe(400);
  });

  it("detecta slug ocupado y cuarentena vigente", async () => {
    const { slug } = await signup();
    const taken = await getJson(`/auth/store/slug-check?slug=${slug}`);
    expect(await taken.json()).toMatchObject({ available: false, reason: "taken" });

    const quarantined = uniqueSlug("cuarentena");
    await testEnv.DB.prepare(
      "INSERT INTO slug_reservation (id, slug, store_id, reason, reserved_until, created_at) VALUES (?, ?, NULL, 'deleted', ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        quarantined,
        Date.now() + 86_400_000,
        Date.now(),
      )
      .run();

    const check = await getJson(`/auth/store/slug-check?slug=${quarantined}`);
    expect(await check.json()).toMatchObject({ available: false, reason: "quarantined" });
  });
});

describe("POST /auth/store/signup", () => {
  it("crea usuario y tienda activa de forma atómica tras el OTP", async () => {
    const { email, slug, response } = await signup();

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { id: string; email: string };
      store: { id: string; slug: string; status: string };
      links: { storefront: string; panel: string };
    };
    expect(body.user.email).toBe(email);
    expect(body.store).toMatchObject({ slug, status: "active" });
    expect(body.links.panel).toBe(`http://${slug}.localhost:5173/panel-admin`);
    expect(JSON.stringify(body)).not.toContain(PASSWORD);

    const store = await testEnv.DB.prepare(
      "SELECT owner_id, status, plan, theme_id, primary_color, color_mode_default, currency, name FROM store WHERE slug = ?",
    )
      .bind(slug)
      .first<{
        owner_id: string;
        status: string;
        plan: string;
        theme_id: string;
        primary_color: string;
        color_mode_default: string;
        currency: string;
        name: string;
      }>();

    expect(store).toMatchObject({
      owner_id: body.user.id,
      status: "active",
      plan: "free",
      theme_id: "rose",
      primary_color: "#C09299",
      color_mode_default: "light",
      currency: "USD",
      name: "Tienda Ejemplo",
    });

    const account = await testEnv.DB.prepare(
      "SELECT provider_id, password FROM store_accounts WHERE user_id = ?",
    )
      .bind(body.user.id)
      .first<{ provider_id: string; password: string }>();
    expect(account?.provider_id).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(PASSWORD);

    const verified = await testEnv.DB.prepare(
      "SELECT email_verified FROM store_users WHERE id = ?",
    )
      .bind(body.user.id)
      .first<{ email_verified: number }>();
    expect(verified?.email_verified).toBe(1);

    const intent = await testEnv.DB.prepare(
      "SELECT consumed_at FROM signup_intent WHERE email = ?",
    )
      .bind(email)
      .first<{ consumed_at: number | null }>();
    expect(intent?.consumed_at).toBeTruthy();
  });

  it("rechaza un OTP expirado", async () => {
    const email = uniqueEmail();
    const slug = uniqueSlug();
    await requestOtp(email, slug);
    const code = extractOtp(findLastEmailTo(email)!.text);

    await testEnv.DB.prepare("UPDATE signup_intent SET expires_at = ? WHERE email = ?")
      .bind(Date.now() - 1000, email)
      .run();

    const response = await postJson("/auth/store/signup", {
      name: "Dueña",
      email,
      password: PASSWORD,
      storeName: "Tienda",
      slug,
      currency: "USD",
      themeId: "rose",
      code,
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as ApiErrorBody).toMatchObject({
      error: { code: "VALIDATION_ERROR", reason: "OTP_EXPIRED" },
    });
  });

  it("rechaza un código incorrecto y cuenta el intento", async () => {
    const email = uniqueEmail();
    const slug = uniqueSlug();
    await requestOtp(email, slug);
    const code = extractOtp(findLastEmailTo(email)!.text);
    const wrong = code === "000000" ? "111111" : "000000";

    const response = await postJson("/auth/store/signup", {
      name: "Dueña",
      email,
      password: PASSWORD,
      storeName: "Tienda",
      slug,
      currency: "USD",
      themeId: "rose",
      code: wrong,
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "OTP_INVALID" },
    });

    const intent = await testEnv.DB.prepare(
      "SELECT attempts FROM signup_intent WHERE email = ?",
    )
      .bind(email)
      .first<{ attempts: number }>();
    expect(intent?.attempts).toBe(1);
  });

  it("invalida el intent a los 5 intentos fallidos", async () => {
    const email = uniqueEmail();
    const slug = uniqueSlug();
    await requestOtp(email, slug);
    const code = extractOtp(findLastEmailTo(email)!.text);
    const wrong = code === "000000" ? "111111" : "000000";

    const payload = {
      name: "Dueña",
      email,
      password: PASSWORD,
      storeName: "Tienda",
      slug,
      currency: "USD",
      themeId: "rose",
    };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await postJson("/auth/store/signup", { ...payload, code: wrong });
      expect(response.status).toBe(400);
      expect((await response.json()) as ApiErrorBody).toMatchObject({
        error: { reason: "OTP_INVALID" },
      });
    }

    const fifth = await postJson("/auth/store/signup", { ...payload, code: wrong });
    expect(fifth.status).toBe(400);
    expect((await fifth.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "OTP_ATTEMPTS_EXHAUSTED" },
    });

    // Incluso con el código correcto el intent ya no sirve.
    const afterExhaustion = await postJson("/auth/store/signup", { ...payload, code });
    expect(afterExhaustion.status).toBe(400);
    expect((await afterExhaustion.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "OTP_INVALID" },
    });

    const stores = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE slug = ?")
      .bind(slug)
      .first<{ total: number }>();
    expect(stores?.total).toBe(0);
  });

  it("bloquea el reenvío antes de 60 s y aplica el tope por email", async () => {
    const email = uniqueEmail();
    const slug = uniqueSlug();

    expect((await requestOtp(email, slug)).status).toBe(202);

    const cooldown = await requestOtp(email, slug);
    expect(cooldown.status).toBe(429);
    expect(cooldown.headers.get("retry-after")).toBeTruthy();
    expect((await cooldown.json()) as ApiErrorBody).toMatchObject({
      error: { code: "RATE_LIMITED", reason: "OTP_COOLDOWN" },
    });

    // Simula que pasaron los 60 s del reenvío: el tope es 3 envíos por hora.
    await testEnv.DB.prepare("UPDATE signup_intent SET last_sent_at = ? WHERE email = ?")
      .bind(Date.now() - 120_000, email)
      .run();
    expect((await requestOtp(email, slug)).status).toBe(202);

    await testEnv.DB.prepare("UPDATE signup_intent SET last_sent_at = ? WHERE email = ?")
      .bind(Date.now() - 120_000, email)
      .run();
    const limited = await requestOtp(email, slug);
    expect(limited.status).toBe(429);
    expect((await limited.json()) as ApiErrorBody).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });

  it("limita el registro completo a 5 por hora e IP", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 5; i += 1) {
      const response = await postJson(
        "/auth/store/signup",
        {
          name: "Dueña",
          email: uniqueEmail(),
          password: PASSWORD,
          storeName: "Tienda",
          slug: uniqueSlug(),
          currency: "USD",
          themeId: "rose",
          code: "123456",
        },
        { "x-client-ip": ip },
      );
      // Sin intent previo: 400, pero el contador por IP avanza.
      expect(response.status).toBe(400);
    }

    const blocked = await postJson(
      "/auth/store/signup",
      {
        name: "Dueña",
        email: uniqueEmail(),
        password: PASSWORD,
        storeName: "Tienda",
        slug: uniqueSlug(),
        currency: "USD",
        themeId: "rose",
        code: "123456",
      },
      { "x-client-ip": ip },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("rechaza email y slug duplicados en la revalidación final", async () => {
    const first = await signup();
    expect(first.response.status).toBe(201);

    // Carrera real: el intent se crea con un email libre y, antes del POST
    // final, otra petición registra esa cuenta/slug. El API revalida y gana la
    // constraint, no la comprobación previa.
    const email = uniqueEmail("carrera");
    const slug = uniqueSlug("carrera");
    expect((await requestOtp(email, slug)).status).toBe(202);
    const code = extractOtp(findLastEmailTo(email)!.text);

    await testEnv.DB.prepare(
      "INSERT INTO store_users (id, email, email_verified, name, created_at, updated_at) VALUES (?, ?, 1, 'Otro', ?, ?)",
    )
      .bind(crypto.randomUUID(), email, Date.now(), Date.now())
      .run();

    const duplicatedEmail = await postJson(
      "/auth/store/signup",
      {
        name: "Dueña",
        email,
        password: PASSWORD,
        storeName: "Tienda",
        slug,
        currency: "USD",
        themeId: "rose",
        code,
      },
      { "x-client-ip": nextTestIp() },
    );
    expect(duplicatedEmail.status).toBe(409);
    expect((await duplicatedEmail.json()) as ApiErrorBody).toMatchObject({
      error: { code: "CONFLICT", reason: "EMAIL_TAKEN" },
    });

    // Mismo escenario para el slug: otro dueño lo tomó antes del POST final.
    const email2 = uniqueEmail("carrera2");
    const slug2 = uniqueSlug("carrera2");
    expect((await requestOtp(email2, slug2)).status).toBe(202);
    const code2 = extractOtp(findLastEmailTo(email2)!.text);

    const ownerId = crypto.randomUUID();
    const now = Date.now();
    await testEnv.DB.batch([
      testEnv.DB.prepare(
        "INSERT INTO store_users (id, email, email_verified, name, created_at, updated_at) VALUES (?, ?, 1, 'Otro', ?, ?)",
      ).bind(ownerId, uniqueEmail("otro"), now, now),
      testEnv.DB.prepare(
        "INSERT INTO store (id, owner_id, slug, name, status, theme_id, primary_color, color_mode_default, currency, plan, created_at, updated_at) VALUES (?, ?, ?, 'Otra', 'active', 'rose', '#C09299', 'light', 'USD', 'free', ?, ?)",
      ).bind(crypto.randomUUID(), ownerId, slug2, now, now),
    ]);

    const duplicatedSlug = await postJson(
      "/auth/store/signup",
      {
        name: "Dueña",
        email: email2,
        password: PASSWORD,
        storeName: "Tienda",
        slug: slug2,
        currency: "USD",
        themeId: "rose",
        code: code2,
      },
      { "x-client-ip": nextTestIp() },
    );
    expect(duplicatedSlug.status).toBe(409);
    expect((await duplicatedSlug.json()) as ApiErrorBody).toMatchObject({
      error: { code: "CONFLICT", reason: "SLUG_TAKEN" },
    });
  });

  it("rechaza slugs reservados y temas desconocidos", async () => {
    const reserved = await postJson("/auth/store/signup/otp", {
      email: uniqueEmail(),
      slug: "api",
      turnstileToken: "test-token",
    });
    expect(reserved.status).toBe(400);
    expect((await reserved.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "SLUG_RESERVED" },
    });

    const email = uniqueEmail();
    const slug = uniqueSlug();
    await requestOtp(email, slug);
    const code = extractOtp(findLastEmailTo(email)!.text);
    const badTheme = await postJson("/auth/store/signup", {
      name: "Dueña",
      email,
      password: PASSWORD,
      storeName: "Tienda",
      slug,
      currency: "USD",
      themeId: "no-existe",
      code,
    });
    expect(badTheme.status).toBe(400);
    expect((await badTheme.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "THEME_UNAVAILABLE" },
    });
  });

  it("exige Turnstile aunque el resto sea válido", async () => {
    const response = await postJson("/auth/store/signup/otp", {
      email: uniqueEmail(),
      slug: uniqueSlug(),
      turnstileToken: "",
    });
    expect(response.status).toBe(400);
  });

  it("no revela si el email existe al pedir el OTP", async () => {
    const { email, slug } = await signup();
    const other = uniqueSlug();
    const before = emailOutbox.length;

    const response = await requestOtp(email, other);
    expect(response.status).toBe(202);
    // Misma respuesta, pero no se envía código para una cuenta existente.
    expect(emailOutbox.length).toBe(before);
    expect(slug).toBeTruthy();

    const finalResponse = await postJson(
      "/auth/store/signup",
      {
        name: "Otra",
        email,
        password: PASSWORD,
        storeName: "Otra tienda",
        slug: other,
        currency: "USD",
        themeId: "rose",
        code: "123456",
      },
      { "x-client-ip": nextTestIp() },
    );
    expect(finalResponse.status).toBe(400);
  });
});

describe("login de tienda", () => {
  it("inicia sesión con cookie host-only y sin tokens en el body", async () => {
    const { email, slug } = await signup();

    const response = await login(email, PASSWORD, slug);
    expect(response.status).toBe(200);

    const raw = setCookies(response);
    expect(raw.length).toBeGreaterThan(0);
    const sessionCookie = raw.find((cookie) => cookie.startsWith("store.session_token="));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).not.toMatch(/domain=/i);
    expect(sessionCookie).not.toContain("Secure");

    const body = (await response.json()) as {
      user: { id: string; email: string };
      store: { slug: string; status: string };
      expiresAt: string;
    };
    expect(body.user.email).toBe(email);
    expect(body.store.slug).toBe(slug);
    expect(body.expiresAt).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("rechaza credenciales incorrectas sin filtrar si el email existe", async () => {
    const { email, slug } = await signup();

    const wrongPassword = await login(email, "OtraContraseña1", slug);
    expect(wrongPassword.status).toBe(401);
    expect(hasCookie(wrongPassword, "store.session_token")).toBe(false);
    expect((await wrongPassword.json()) as ApiErrorBody).toMatchObject({
      error: { code: "UNAUTHORIZED", reason: "INVALID_CREDENTIALS" },
    });

    const unknownEmail = await login(uniqueEmail("nadie"), PASSWORD, slug);
    expect(unknownEmail.status).toBe(401);
    expect((await unknownEmail.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "INVALID_CREDENTIALS" },
    });
  });

  it("devuelve 403 si el dueño es de otra tienda y no emite cookie", async () => {
    const owner = await signup();
    const other = await signup();

    const response = await login(owner.email, PASSWORD, other.slug);
    expect(response.status).toBe(403);
    expect(hasCookie(response, "store.session_token")).toBe(false);
    expect((await response.json()) as ApiErrorBody).toMatchObject({
      error: { code: "FORBIDDEN", reason: "STORE_MISMATCH" },
    });

    // La sesión creada durante el intento se revoca: la cookie no existe y el
    // token no quedó vivo en D1.
    const sessions = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM store_sessions WHERE user_id = (SELECT id FROM store_users WHERE email = ?)",
    )
      .bind(owner.email)
      .first<{ total: number }>();
    expect(sessions?.total).toBe(0);
  });

  it("exige la cabecera interna de tienda y rechaza hosts inexistentes", async () => {
    const missing = await postJson("/auth/store/login", {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "STORE_SLUG_MISSING" },
    });

    const unknown = await login(uniqueEmail(), PASSWORD, "no-existe-esta-tienda");
    expect(unknown.status).toBe(404);
    expect((await unknown.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "STORE_NOT_FOUND" },
    });
  });

  it("B1: `?siteId` ya no resuelve la tienda en el API", async () => {
    const { email, slug, response } = await signup();
    const body = (await response.json()) as { store: { id: string } };

    // Con `?siteId` y sin `x-store-slug`, el API no adivina la tienda.
    const bySiteId = await postJson(
      `/auth/store/login?siteId=${body.store.id}`,
      { email, password: PASSWORD },
      { "x-client-ip": nextTestIp() },
    );
    expect(bySiteId.status).toBe(400);
    expect((await bySiteId.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "STORE_SLUG_MISSING" },
    });

    const sessionBySiteId = await getJson(
      `/auth/store/session?siteId=${body.store.id}`,
    );
    expect(sessionBySiteId.status).toBe(400);
    expect((await sessionBySiteId.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "STORE_SLUG_MISSING" },
    });

    // La cabecera interna sí (y solo ella) resuelve la tienda.
    expect((await login(email, PASSWORD, slug)).status).toBe(200);
  });
});

describe("sesión de tienda", () => {
  it("devuelve sesión + tienda y la invalida al cerrar sesión", async () => {
    const { email, slug } = await signup();
    const loginResponse = await login(email, PASSWORD, slug);
    const cookie = cookiePair(loginResponse, "store.session_token");

    const session = await getJson("/auth/store/session", {
      cookie,
      "x-store-slug": slug,
    });
    expect(session.status).toBe(200);
    const body = (await session.json()) as {
      user: { email: string };
      store: { slug: string };
    };
    expect(body.user.email).toBe(email);
    expect(body.store.slug).toBe(slug);

    const logout = await postJson("/auth/store/logout", {}, { cookie });
    expect(logout.status).toBe(204);
    expect(hasCookie(logout, "store.session_token")).toBe(true);

    const afterLogout = await getJson("/auth/store/session", {
      cookie,
      "x-store-slug": slug,
    });
    expect(afterLogout.status).toBe(401);

    const sessions = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM store_sessions WHERE user_id = (SELECT id FROM store_users WHERE email = ?)",
    )
      .bind(email)
      .first<{ total: number }>();
    expect(sessions?.total).toBe(0);
  });

  it("401 sin cookie y 403 con la sesión de otra tienda", async () => {
    const anonymous = await getJson("/auth/store/session", {
      "x-store-slug": uniqueSlug(),
    });
    expect(anonymous.status).toBe(404);

    const owner = await signup();
    const other = await signup();
    const loginResponse = await login(owner.email, PASSWORD, owner.slug);
    const cookie = cookiePair(loginResponse, "store.session_token");

    const foreign = await getJson("/auth/store/session", {
      cookie,
      "x-store-slug": other.slug,
    });
    expect(foreign.status).toBe(403);
    expect((await foreign.json()) as ApiErrorBody).toMatchObject({
      error: { reason: "STORE_MISMATCH" },
    });
  });

  it("una cookie del console no abre el reino tienda", async () => {
    const { slug } = await signup();
    const response = await getJson("/auth/store/session", {
      cookie: "console.session_token=falso",
      "x-store-slug": slug,
    });
    expect(response.status).toBe(401);
  });
});

describe("recuperación de contraseña de tienda", () => {
  it("responde igual para emails existentes e inexistentes", async () => {
    const { email } = await signup();

    const known = await postJson("/auth/store/password/forgot", { email });
    expect(known.status).toBe(202);
    const knownBody = (await known.json()) as { ok: boolean };

    const unknown = await postJson("/auth/store/password/forgot", { email: uniqueEmail("nadie") });
    expect(unknown.status).toBe(202);
    expect(await unknown.json()).toEqual(knownBody);

    const message = findLastEmailTo(email);
    expect(message).toBeTruthy();
    expect(message!.text).toContain("http://");
  });

  it("cambia la contraseña con el enlace de un solo uso y revoca sesiones", async () => {
    const { email, slug } = await signup();
    const loginResponse = await login(email, PASSWORD, slug);
    const cookie = cookiePair(loginResponse, "store.session_token");

    expect((await postJson("/auth/store/password/forgot", { email })).status).toBe(202);
    const message = findLastEmailTo(email)!;
    const token = extractResetToken(message.text);

    const reset = await postJson("/auth/store/password/reset", {
      token,
      password: "NuevaContraseña456",
    });
    expect(reset.status).toBe(204);

    // La sesión anterior quedó revocada.
    const staleSession = await getJson("/auth/store/session", {
      cookie,
      "x-store-slug": slug,
    });
    expect(staleSession.status).toBe(401);

    // El enlace es de un solo uso.
    const reuse = await postJson("/auth/store/password/reset", {
      token,
      password: "OtraContraseña789",
    });
    expect(reuse.status).toBe(400);

    expect((await login(email, PASSWORD, slug)).status).toBe(401);
    expect((await login(email, "NuevaContraseña456", slug)).status).toBe(200);
  });

  it("limita las peticiones de reset por email", async () => {
    const { email } = await signup();
    for (let i = 0; i < 3; i += 1) {
      expect((await postJson("/auth/store/password/forgot", { email })).status).toBe(202);
    }
    const blocked = await postJson("/auth/store/password/forgot", { email });
    expect(blocked.status).toBe(429);
  });

  it("B4: limita los tokens de reset inválidos por IP", async () => {
    const ip = nextTestIp();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postJson(
        "/auth/store/password/reset",
        { token: `inventado-${attempt}`, password: "OtraClave123" },
        { "x-client-ip": ip },
      );
      expect(response.status).toBe(400);
      expect((await response.json()) as ApiErrorBody).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    }

    const blocked = await postJson(
      "/auth/store/password/reset",
      { token: "inventado-final", password: "OtraClave123" },
      { "x-client-ip": ip },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
