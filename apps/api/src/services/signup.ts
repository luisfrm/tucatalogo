/**
 * Registro de tienda sin persistir nada antes del OTP (PLAN §4.5 A / §7.3).
 *
 * - `slug-check`: solo lectura, informa formato/reservado/ocupado/cuarentena.
 * - `signup/otp`: Turnstile + rate limits, crea o renueva `signup_intent`
 *   (hash del código, 10 min, 5 intentos, reenvío a 60 s) y envía el código.
 * - `signup`: payload completo + código; verifica y consume el intent,
 *   revalida email y slug y crea usuario + tienda de forma atómica.
 *
 * La contraseña **nunca** se guarda antes del último paso: solo viaja en ese
 * POST y se transforma en hash dentro de la misma transacción.
 */
import { getSlugRejectionReason, normalizeSlugInput } from "@tucatalogo/shared";
import type { Database } from "@tucatalogo/db";
import type {
  SignupInput,
  SignupOtpInput,
  SignupResponse,
  SlugCheckResponse,
} from "@tucatalogo/types";
import { hashPassword } from "better-auth/crypto";
import { getTheme, type ThemeDefinition } from "@tucatalogo/themes";

import {
  AUTH_MESSAGES,
  AUTH_REASONS,
  SIGNUP_OTP,
  STORE_DEFAULTS,
} from "../constants/auth";
import type { Env } from "../env";
import { AppError } from "../errors";
import { generateOtp, hashIp, hashOtp, timingSafeEqual } from "../libs/crypto";
import { verifyTurnstile } from "../libs/turnstile";
import {
  createStoreWithOwner,
  findStoreBySlug,
  findStoreUserById,
} from "../repositories/auth-store";
import {
  consumeSignupIntent,
  findActiveSignupIntent,
  hasActiveSlugReservation,
  incrementSignupIntentAttempts,
  isSlugTaken,
  isStoreEmailTaken,
  replaceSignupIntent,
} from "../repositories/signup";
import { sendSignupOtpEmail, storeOrigin } from "./auth-email";
import { assertRateLimit } from "./rate-limit";

function invalid(reason: string, message: string) {
  return new AppError("VALIDATION_ERROR", message, undefined, reason);
}

/** `GET /auth/store/slug-check`. Nunca lanza por slug inválido: lo informa. */
export async function checkSlugAvailability(
  env: Env,
  db: Database,
  rawSlug: string,
  now: Date = new Date(),
): Promise<SlugCheckResponse> {
  const slug = normalizeSlugInput(rawSlug);
  const rejection = getSlugRejectionReason(slug);

  if (rejection === "empty") {
    return { slug, available: false, reason: "empty", links: null };
  }
  if (rejection === "format") {
    return { slug, available: false, reason: "format", links: null };
  }
  if (rejection === "reserved") {
    return { slug, available: false, reason: "reserved", links: null };
  }
  if (await isSlugTaken(db, slug)) {
    return { slug, available: false, reason: "taken", links: null };
  }
  if (await hasActiveSlugReservation(db, slug, now)) {
    return { slug, available: false, reason: "quarantined", links: null };
  }

  const origin = storeOrigin(env, slug);
  return {
    slug,
    available: true,
    reason: null,
    links: { storefront: origin, panel: `${origin}/panel-admin` },
  };
}

/** Valida formato/reservado y lanza 400 tipado (escritura, no consulta). */
function assertUsableSlug(rawSlug: string): string {
  const slug = normalizeSlugInput(rawSlug);
  const rejection = getSlugRejectionReason(slug);
  if (rejection === "reserved") {
    throw invalid(AUTH_REASONS.slugReserved, AUTH_MESSAGES.slugReserved);
  }
  if (rejection !== null) {
    throw invalid(AUTH_REASONS.slugFormat, AUTH_MESSAGES.storeSlugInvalid);
  }
  return slug;
}

async function assertSlugFree(db: Database, slug: string, now: Date): Promise<void> {
  if (await isSlugTaken(db, slug)) {
    throw new AppError("CONFLICT", AUTH_MESSAGES.slugTaken, undefined, AUTH_REASONS.slugTaken);
  }
  if (await hasActiveSlugReservation(db, slug, now)) {
    throw new AppError(
      "CONFLICT",
      AUTH_MESSAGES.slugQuarantined,
      undefined,
      AUTH_REASONS.slugQuarantined,
    );
  }
}

function assertTurnstile(result: Awaited<ReturnType<typeof verifyTurnstile>>): void {
  if (result.ok) return;
  if (result.failure.kind === "config") {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Turnstile mal configurado",
        detail: result.failure.message,
      }),
    );
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  if (result.failure.kind === "unavailable") {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  throw new AppError(
    "VALIDATION_ERROR",
    AUTH_MESSAGES.turnstileFailed,
    [{ path: "turnstileToken", message: AUTH_MESSAGES.turnstileFailed }],
    AUTH_REASONS.turnstileFailed,
  );
}

export interface SignupOtpResult {
  ok: true;
  resendAfterSeconds: number;
  expiresInMinutes: number;
}

/**
 * `POST /auth/store/signup/otp`.
 *
 * Anti-enumeración (PLAN §7.3): si el email ya tiene cuenta, la respuesta es
 * idéntica y **no** se envía un código. El aviso real llega en el POST final.
 */
export async function requestSignupOtp(
  env: Env,
  db: Database,
  input: SignupOtpInput,
  ip: string,
  now: Date = new Date(),
): Promise<SignupOtpResult> {
  const secret = env.BETTER_AUTH_SECRET_STORE;
  if (!secret) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }

  assertTurnstile(await verifyTurnstile(env, input.turnstileToken, ip));

  const slug = assertUsableSlug(input.slug);
  const [ipKey, emailKey] = [await hashIp(secret, ip), await hashIp(secret, input.email)];

  await assertRateLimit(db, "otpRequestByIp", ipKey);
  await assertRateLimit(db, "otpRequestByEmail", emailKey);

  const emailTaken = await isStoreEmailTaken(db, input.email);
  await assertSlugFree(db, slug, now);

  if (emailTaken) {
    return {
      ok: true,
      resendAfterSeconds: Math.ceil(SIGNUP_OTP.resendCooldownMs / 1000),
      expiresInMinutes: Math.round(SIGNUP_OTP.ttlMs / 60000),
    };
  }

  const previous = await findActiveSignupIntent(db, input.email);
  if (previous) {
    const elapsed = now.getTime() - previous.lastSentAt.getTime();
    if (elapsed < SIGNUP_OTP.resendCooldownMs) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((SIGNUP_OTP.resendCooldownMs - elapsed) / 1000),
      );
      throw new AppError(
        "RATE_LIMITED",
        AUTH_MESSAGES.otpCooldown,
        undefined,
        AUTH_REASONS.otpCooldown,
        { "retry-after": String(retryAfterSeconds) },
      );
    }
  }

  const intentId = crypto.randomUUID();
  const code = generateOtp();
  await replaceSignupIntent(db, {
    id: intentId,
    email: input.email,
    otpHash: await hashOtp(secret, intentId, code),
    attempts: 0,
    expiresAt: new Date(now.getTime() + SIGNUP_OTP.ttlMs),
    lastSentAt: now,
    consumedAt: null,
    ipHash: ipKey,
    createdAt: now,
  });

  await sendSignupOtpEmail(env, { to: input.email, code });

  return {
    ok: true,
    resendAfterSeconds: Math.ceil(SIGNUP_OTP.resendCooldownMs / 1000),
    expiresInMinutes: Math.round(SIGNUP_OTP.ttlMs / 60000),
  };
}

function translateUniqueViolation(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("store_users.email")) {
    return new AppError("CONFLICT", AUTH_MESSAGES.emailTaken, undefined, AUTH_REASONS.emailTaken);
  }
  if (message.includes("store.slug")) {
    return new AppError("CONFLICT", AUTH_MESSAGES.slugTaken, undefined, AUTH_REASONS.slugTaken);
  }
  if (message.includes("store.owner_id")) {
    return new AppError("CONFLICT", AUTH_MESSAGES.emailTaken, undefined, AUTH_REASONS.emailTaken);
  }
  return new AppError("INTERNAL", "No pudimos crear la tienda. Inténtalo de nuevo.");
}

/**
 * `POST /auth/store/signup`: crea `store_users` + `store` (`active`) y consume
 * el intent en un único batch. Las constraints únicas son la última palabra.
 */
export async function completeSignup(
  env: Env,
  db: Database,
  input: SignupInput,
  ip: string,
  now: Date = new Date(),
): Promise<SignupResponse> {
  const secret = env.BETTER_AUTH_SECRET_STORE;
  if (!secret) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }

  await assertRateLimit(db, "signupCompleteByIp", await hashIp(secret, ip));

  const slug = assertUsableSlug(input.slug);

  const intent = await findActiveSignupIntent(db, input.email);
  if (!intent) {
    throw invalid(AUTH_REASONS.otpInvalid, AUTH_MESSAGES.otpInvalid);
  }
  if (intent.expiresAt.getTime() <= now.getTime()) {
    await consumeSignupIntent(db, intent.id, now);
    throw invalid(AUTH_REASONS.otpExpired, AUTH_MESSAGES.otpExpired);
  }
  if (intent.attempts >= SIGNUP_OTP.maxAttempts) {
    await consumeSignupIntent(db, intent.id, now);
    throw invalid(AUTH_REASONS.otpAttemptsExhausted, AUTH_MESSAGES.otpAttemptsExhausted);
  }

  const expected = await hashOtp(secret, intent.id, input.code);
  if (!timingSafeEqual(intent.otpHash, expected)) {
    const attempts = await incrementSignupIntentAttempts(db, intent.id);
    if (attempts >= SIGNUP_OTP.maxAttempts) {
      await consumeSignupIntent(db, intent.id, now);
      throw invalid(AUTH_REASONS.otpAttemptsExhausted, AUTH_MESSAGES.otpAttemptsExhausted);
    }
    throw invalid(AUTH_REASONS.otpInvalid, AUTH_MESSAGES.otpInvalid);
  }

  // Revalidación obligatoria: entre el OTP y este POST pudo cambiar el mundo.
  if (await isStoreEmailTaken(db, input.email)) {
    throw new AppError("CONFLICT", AUTH_MESSAGES.emailTaken, undefined, AUTH_REASONS.emailTaken);
  }
  await assertSlugFree(db, slug, now);

  let theme: ThemeDefinition;
  try {
    theme = getTheme(input.themeId);
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "Ese tema no está disponible.",
      [{ path: "themeId", message: "Tema desconocido" }],
      AUTH_REASONS.themeUnavailable,
    );
  }

  const userId = crypto.randomUUID();
  const storeId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    await createStoreWithOwner(db, {
      now,
      intentId: intent.id,
      user: { id: userId, email: input.email, name: input.name, emailVerified: true },
      account: { id: crypto.randomUUID(), passwordHash },
      store: {
        id: storeId,
        slug,
        name: input.storeName,
        status: STORE_DEFAULTS.status,
        themeId: theme.id,
        primaryColor: input.primaryColor ?? theme.defaultPrimaryColor,
        colorModeDefault: STORE_DEFAULTS.colorModeDefault,
        currency: input.currency,
        plan: STORE_DEFAULTS.plan,
        whatsappNumber: input.whatsappNumber ?? null,
        whatsappMessageTemplate: STORE_DEFAULTS.whatsappMessageTemplate,
      },
    });
  } catch (error) {
    throw translateUniqueViolation(error);
  }

  const user = await findStoreUserById(db, userId);
  const store = await findStoreBySlug(db, slug);
  if (!user || !store) {
    throw new AppError("INTERNAL", "No pudimos crear la tienda. Inténtalo de nuevo.");
  }

  const origin = storeOrigin(env, store.slug);
  return {
    user: { id: user.id, name: user.name, email: user.email },
    store: { id: store.id, slug: store.slug, name: store.name, status: store.status },
    links: { storefront: origin, panel: `${origin}/panel-admin` },
  };
}
