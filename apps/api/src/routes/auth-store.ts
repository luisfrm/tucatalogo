/**
 * Rutas del reino **tienda** (PLAN §8.2): `/auth/store/*`.
 *
 * Cada route valida Zod, aplica rate limits y delega en el service. El API
 * nunca confía en `store_id`: la tienda sale de la cabecera interna
 * `x-store-slug` (o `?siteId` en dev) y de la sesión.
 *
 * Se encadena la definición para que `AppType` exponga el contrato a Hono RPC
 * (el comportamiento es idéntico al de las llamadas sueltas).
 */
import { Hono } from "hono";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupOtpSchema,
  signupSchema,
  slugCheckInputSchema,
  storeLoginSchema,
} from "@tucatalogo/types";

import { getStoreAuth } from "../auth";
import { applySetCookies } from "../auth/shared";
import { AppError } from "../errors";
import { getClientIp } from "../libs/ip";
import { parseJsonBody, parseQuery } from "../libs/validate";
import { dbFor } from "../middleware/session";
import {
  loginStore,
  logoutStore,
  readStoreSession,
  requestStorePasswordReset,
  resetStorePassword,
  resolveStore,
} from "../services/auth-store";
import {
  checkSlugAvailability,
  completeSignup,
  requestSignupOtp,
} from "../services/signup";
import type { AppEnv } from "../types";

export const storeAuthRoutes = new Hono<AppEnv>()
  /** GET /auth/store/slug-check?slug= — formato, reservados, ocupado, cuarentena. */
  .get("/slug-check", async (c) => {
    const { slug } = parseQuery(c, slugCheckInputSchema);
    const availability = await checkSlugAvailability(c.env, dbFor(c), slug);
    return c.json(availability);
  })
  /** POST /auth/store/signup/otp — Turnstile + rate limits + envío del código. */
  .post("/signup/otp", async (c) => {
    const input = await parseJsonBody(c, signupOtpSchema);
    const result = await requestSignupOtp(
      c.env,
      dbFor(c),
      input,
      getClientIp(c.req.raw.headers),
    );
    return c.json(result, 202);
  })
  /** POST /auth/store/signup — payload completo + código; crea tienda y dueño. */
  .post("/signup", async (c) => {
    const input = await parseJsonBody(c, signupSchema);
    const result = await completeSignup(
      c.env,
      dbFor(c),
      input,
      getClientIp(c.req.raw.headers),
    );
    return c.json(result, 201);
  })
  /** POST /auth/store/login — credenciales + propiedad de la tienda del host. */
  .post("/login", async (c) => {
    const input = await parseJsonBody(c, storeLoginSchema);
    const db = dbFor(c);
    // B1: la tienda sale solo de `x-store-slug`; `?siteId` ya no resuelve nada.
    const { store } = await resolveStore(db, c.req.raw.headers);

    const result = await loginStore(
      c.env,
      db,
      getStoreAuth(c.env),
      input,
      store,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    applySetCookies(c, result.setCookies);
    return c.json(result.session);
  })
  /** GET /auth/store/session — sesión + tienda para el loader del panel. */
  .get("/session", async (c) => {
    const db = dbFor(c);
    const { store } = await resolveStore(db, c.req.raw.headers);

    const result = await readStoreSession(
      getStoreAuth(c.env),
      store,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );

    if (!result) {
      throw new AppError("UNAUTHORIZED", "Inicia sesión para continuar.");
    }

    applySetCookies(c, result.setCookies);
    return c.json(result.session);
  })
  /** POST /auth/store/logout — invalida la fila de sesión y borra la cookie. */
  .post("/logout", async (c) => {
    const setCookies = await logoutStore(
      getStoreAuth(c.env),
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    applySetCookies(c, setCookies);
    return c.body(null, 204);
  })
  /** POST /auth/store/password/forgot — misma respuesta exista o no el email. */
  .post("/password/forgot", async (c) => {
    const input = await parseJsonBody(c, forgotPasswordSchema);
    await requestStorePasswordReset(
      c.env,
      dbFor(c),
      getStoreAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    return c.json({ ok: true }, 202);
  })
  /** POST /auth/store/password/reset — enlace de un solo uso (30 min). */
  .post("/password/reset", async (c) => {
    const input = await parseJsonBody(c, resetPasswordSchema);
    await resetStorePassword(
      c.env,
      dbFor(c),
      getStoreAuth(c.env),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    return c.body(null, 204);
  });
