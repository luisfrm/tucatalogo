/**
 * Rutas del reino **console** (PLAN §8.2): `/auth/console/*`.
 *
 * `/init` es one-time y no pide credencial compartida: lo protege Cloudflare
 * Access delante del host del console. Toda sesión de console exige 2FA
 * completado; el reset de contraseña no lo salta.
 *
 * Se encadena la definición para que `AppType` exponga el contrato a Hono RPC
 * (el comportamiento es idéntico al de las llamadas sueltas).
 */
import { Hono } from "hono";

import {
  consoleInitSchema,
  consoleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  twoFactorSetupSchema,
  twoFactorVerifySchema,
} from "@tucatalogo/types";

import { getConsoleAuth } from "../auth";
import { applySetCookies } from "../auth/shared";
import { AppError } from "../errors";
import { getClientIp } from "../libs/ip";
import { parseJsonBody } from "../libs/validate";
import { dbFor } from "../middleware/session";
import {
  getInitStatus,
  initConsole,
  loginConsole,
  logoutConsole,
  readConsoleSession,
  requestConsolePasswordReset,
  resetConsolePassword,
  setupConsoleTwoFactor,
  verifyConsoleTwoFactor,
} from "../services/auth-console";
import type { AppEnv } from "../types";

export const consoleAuthRoutes = new Hono<AppEnv>()
  /** GET /auth/console/init-status — ¿queda disponible el alta inicial? */
  .get("/init-status", async (c) => {
    const status = await getInitStatus(dbFor(c));
    return c.json(status);
  })
  /** POST /auth/console/init — one-time; después 410 exista o no el token. */
  .post("/init", async (c) => {
    const input = await parseJsonBody(c, consoleInitSchema);
    const result = await initConsole(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    // M1: sin `Set-Cookie`; el challenge de enrolamiento va en el body.
    return c.json(result.response, 201);
  })
  /** POST /auth/console/login — contraseña → challenge de 2FA o enrolamiento. */
  .post("/login", async (c) => {
    const input = await parseJsonBody(c, consoleLoginSchema);
    const result = await loginConsole(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    applySetCookies(c, result.setCookies);
    return c.json(result.response);
  })
  /** GET /auth/console/session — exige 2FA completado. */
  .get("/session", async (c) => {
    const result = await readConsoleSession(
      dbFor(c),
      getConsoleAuth(c.env),
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    if (!result) {
      throw new AppError("UNAUTHORIZED", "Inicia sesión para continuar.");
    }

    applySetCookies(c, result.setCookies);
    return c.json(result.response);
  })
  /** POST /auth/console/logout. */
  .post("/logout", async (c) => {
    const setCookies = await logoutConsole(
      getConsoleAuth(c.env),
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    applySetCookies(c, setCookies);
    return c.body(null, 204);
  })
  /** POST /auth/console/2fa/setup — enrolamiento obligatorio (con contraseña). */
  .post("/2fa/setup", async (c) => {
    const input = await parseJsonBody(c, twoFactorSetupSchema);
    const result = await setupConsoleTwoFactor(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    // M1: sin `Set-Cookie`; el challenge de enrolamiento va en el body.
    return c.json(result.response);
  })
  /** POST /auth/console/2fa/verify — TOTP o backup code (un solo uso). */
  .post("/2fa/verify", async (c) => {
    const input = await parseJsonBody(c, twoFactorVerifySchema);
    const setCookies = await verifyConsoleTwoFactor(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    applySetCookies(c, setCookies);
    return c.body(null, 204);
  })
  /** POST /auth/console/password/forgot — misma respuesta siempre. */
  .post("/password/forgot", async (c) => {
    const input = await parseJsonBody(c, forgotPasswordSchema);
    await requestConsolePasswordReset(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    return c.json({ ok: true }, 202);
  })
  /** POST /auth/console/password/reset — no salta el 2FA del siguiente login. */
  .post("/password/reset", async (c) => {
    const input = await parseJsonBody(c, resetPasswordSchema);
    await resetConsolePassword(
      c.env,
      dbFor(c),
      getConsoleAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    return c.body(null, 204);
  });
