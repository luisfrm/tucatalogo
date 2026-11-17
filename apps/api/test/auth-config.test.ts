import { describe, expect, it } from "vitest";

import type { Env } from "../src/env";
import { AppError } from "../src/errors";
import { createEmailDriver, findLastEmailTo } from "../src/libs/email";
import { verifyTurnstile } from "../src/libs/turnstile";
import { consoleOrigin, storeOrigin } from "../src/services/auth-email";
import { testEnv } from "./env";
import {
  api,
  extractOtp,
  nextTestIp,
  postJson,
  uniqueEmail,
  uniqueSlug,
  withEnv,
} from "./helpers";

function asEnv(partial: Partial<Env>): Env {
  return partial as Env;
}

/** Ejecuta y devuelve el `AppError` lanzado (o falla el test). */
function captureAppError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("La llamada debía lanzar AppError");
}

describe("EMAIL_DRIVER sin fallback", () => {
  it("503 si EMAIL_DRIVER=resend sin API key", () => {
    const error = captureAppError(() => createEmailDriver(asEnv({ EMAIL_DRIVER: "resend" })));
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("503 si EMAIL_DRIVER=resend sin remitente", () => {
    const error = captureAppError(() =>
      createEmailDriver(asEnv({ EMAIL_DRIVER: "resend", RESEND_API_KEY: "re_test" })),
    );
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("503 si falta EMAIL_DRIVER o es desconocido", () => {
    expect(captureAppError(() => createEmailDriver(asEnv({}))).code).toBe("SERVICE_UNAVAILABLE");
    expect(
      captureAppError(() =>
        createEmailDriver(asEnv({ EMAIL_DRIVER: "smtp" as unknown as Env["EMAIL_DRIVER"] })),
      ).code,
    ).toBe("SERVICE_UNAVAILABLE");
  });

  it("503 si EMAIL_DRIVER=memory fuera de local", () => {
    for (const environment of ["production", "development"]) {
      const error = captureAppError(() =>
        createEmailDriver(asEnv({ EMAIL_DRIVER: "memory", ENVIRONMENT: environment })),
      );
      expect(error.code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  it("memory se acepta en local (outbox de desarrollo)", () => {
    const driver = createEmailDriver(asEnv({ EMAIL_DRIVER: "memory", ENVIRONMENT: "local" }));
    expect(driver.name).toBe("memory");
  });

  it("M4: EMAIL_DRIVER=console fuera de local es 503 (nunca escribe el OTP en logs)", () => {
    for (const environment of ["development", "production"]) {
      const error = captureAppError(() =>
        createEmailDriver(asEnv({ EMAIL_DRIVER: "console", ENVIRONMENT: environment })),
      );
      expect(error.code).toBe("SERVICE_UNAVAILABLE");
    }
    const local = createEmailDriver(asEnv({ EMAIL_DRIVER: "console", ENVIRONMENT: "local" }));
    expect(local.name).toBe("console");
  });

  it("el driver se construye sin enviar cuando la configuración es completa", () => {
    const driver = createEmailDriver(
      asEnv({
        EMAIL_DRIVER: "resend",
        RESEND_API_KEY: "re_test",
        RESEND_FROM: "TuCatálogo <no-reply@example.com>",
        ENVIRONMENT: "production",
      }),
    );
    expect(driver.name).toBe("resend");
  });

  it("una petición de OTP devuelve 503 con EMAIL_DRIVER=resend sin key", async () => {
    await withEnv({ EMAIL_DRIVER: "resend", RESEND_API_KEY: undefined }, async () => {
      const response = await postJson("/auth/store/signup/otp", {
        email: uniqueEmail(),
        slug: uniqueSlug(),
        turnstileToken: "test-token",
      });
      expect(response.status).toBe(503);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        "SERVICE_UNAVAILABLE",
      );
    });
  });

  it("M4: con EMAIL_DRIVER=console fuera de local no se envía ni se genera el OTP", async () => {
    // Se llama al service en el mismo contexto del test (el `console` del
    // worker no es interceptable desde aquí) y se comprueba que el fallo de
    // configuración ocurre **antes** de enviar nada: no hay correo ni código
    // que pueda acabar en un log.
    const { createDb } = await import("@tucatalogo/db");
    const { requestSignupOtp } = await import("../src/services/signup");
    const db = createDb(testEnv.DB);

    for (const environment of ["development", "production"]) {
      await expect(
        requestSignupOtp(
          { ...testEnv, ENVIRONMENT: environment, EMAIL_DRIVER: "console" },
          db,
          { email: uniqueEmail(), slug: uniqueSlug(), turnstileToken: "test-token" },
          nextTestIp(),
        ),
      ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    }
  });
});

describe("Turnstile sin fallback", () => {
  it("503 (config) si TURNSTILE_MODE=enabled sin secret", async () => {
    const result = await verifyTurnstile(
      { ENVIRONMENT: "production", TURNSTILE_MODE: "enabled" },
      "token",
      nextTestIp(),
    );
    expect(result).toMatchObject({ ok: false, failure: { kind: "config" } });
  });

  it("rechaza un token vacío sin llamar a la red", async () => {
    const result = await verifyTurnstile(
      { ENVIRONMENT: "local", TURNSTILE_MODE: "test" },
      "  ",
      nextTestIp(),
    );
    expect(result).toMatchObject({ ok: false, failure: { kind: "missing-token" } });

    const enabled = await verifyTurnstile(
      { ENVIRONMENT: "production", TURNSTILE_MODE: "enabled", TURNSTILE_SECRET_KEY: "secret" },
      undefined,
      nextTestIp(),
    );
    expect(enabled).toMatchObject({ ok: false, failure: { kind: "missing-token" } });
  });

  it("`disabled` solo vale en local", async () => {
    expect(
      await verifyTurnstile({ ENVIRONMENT: "local", TURNSTILE_MODE: "disabled" }, undefined, "127.0.0.1"),
    ).toEqual({ ok: true });

    expect(
      await verifyTurnstile(
        { ENVIRONMENT: "production", TURNSTILE_MODE: "disabled" },
        "token",
        "127.0.0.1",
      ),
    ).toMatchObject({ ok: false, failure: { kind: "config" } });
  });

  it("503 si TURNSTILE_MODE falta o es desconocido", async () => {
    expect(
      await verifyTurnstile({ ENVIRONMENT: "production" }, "token", "127.0.0.1"),
    ).toMatchObject({ ok: false, failure: { kind: "config" } });
  });
});

describe("orígenes de los enlaces", () => {
  it("sin STORE_ORIGIN_TEMPLATE o CONSOLE_ORIGIN → 503", () => {
    expect(captureAppError(() => storeOrigin(asEnv({}), "demo")).code).toBe("SERVICE_UNAVAILABLE");
    expect(captureAppError(() => consoleOrigin(asEnv({}))).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("sustituye {slug} en la plantilla de tienda", () => {
    expect(
      storeOrigin(asEnv({ STORE_ORIGIN_TEMPLATE: "https://{slug}.example.com" }), "demo"),
    ).toBe("https://demo.example.com");
  });
});

describe("health y configuración", () => {
  it("503 si MEDIA_BASE_URL falta", async () => {
    await withEnv({ MEDIA_BASE_URL: "" }, async () => {
      const response = await api("/health");
      expect(response.status).toBe(503);
      const body = (await response.json()) as { checks: Record<string, string> };
      expect(body.checks.media).toBe("error");
    });
  });

  it("slug-check funciona sin secretos de Better Auth y login da 503", async () => {
    // Primero una tienda real: el login resuelve la tienda antes de autenticar.
    const email = uniqueEmail();
    const slug = uniqueSlug();
    const otp = await postJson("/auth/store/signup/otp", {
      email,
      slug,
      turnstileToken: "test-token",
    });
    expect(otp.status).toBe(202);
    const code = extractOtp(findLastEmailTo(email)!.text);
    const created = await postJson("/auth/store/signup", {
      name: "Dueña",
      email,
      password: "Contraseña123",
      storeName: "Tienda",
      slug,
      currency: "USD",
      themeId: "rose",
      code,
    });
    expect(created.status).toBe(201);

    await withEnv({ BETTER_AUTH_SECRET_STORE: undefined }, async () => {
      // Consulta de disponibilidad: solo lectura, no necesita auth.
      const availability = await api(`/auth/store/slug-check?slug=${slug}`);
      expect(availability.status).toBe(200);

      const login = await postJson(
        "/auth/store/login",
        { email, password: "Contraseña123" },
        { "x-store-slug": slug },
      );
      expect(login.status).toBe(503);
      expect(((await login.json()) as { error: { code: string } }).error.code).toBe(
        "SERVICE_UNAVAILABLE",
      );
    });
  });
});
