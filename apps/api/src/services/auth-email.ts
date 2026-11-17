/**
 * Correos de autenticación (OTP de registro y enlace de reset).
 *
 * Vive en `services` porque decide el texto y el enlace; el transporte lo pone
 * `libs/email` y el driver se elige con `EMAIL_DRIVER` (sin fallback).
 */
import {
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_TTL_SECONDS,
  SIGNUP_OTP,
  AUTH_MESSAGES,
} from "../constants/auth";
import type { Env } from "../env";
import { AppError } from "../errors";
import {
  buildOtpEmail,
  buildPasswordResetEmail,
  createEmailDriver,
} from "../libs/email";

/** Enlace absoluto de reset: origen ya resuelto por el reino, nunca hardcodeado. */
export function buildPasswordResetUrl(
  origin: string,
  realm: "store" | "console",
  token: string,
): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${PASSWORD_RESET_PATH[realm]}?token=${encodeURIComponent(token)}`;
}

export interface PasswordResetEmailInput {
  realm: "store" | "console";
  to: string;
  origin: string;
  token: string;
}

export async function sendPasswordResetEmail(
  env: Env,
  input: PasswordResetEmailInput,
): Promise<void> {
  const driver = createEmailDriver(env);
  await driver.send(
    buildPasswordResetEmail({
      to: input.to,
      url: buildPasswordResetUrl(input.origin, input.realm, input.token),
      minutes: Math.round(PASSWORD_RESET_TTL_SECONDS / 60),
      audience: input.realm,
    }),
  );
}

export interface SignupOtpEmailInput {
  to: string;
  code: string;
}

export async function sendSignupOtpEmail(env: Env, input: SignupOtpEmailInput): Promise<void> {
  const driver = createEmailDriver(env);
  await driver.send(
    buildOtpEmail({
      to: input.to,
      code: input.code,
      minutes: Math.round(SIGNUP_OTP.ttlMs / 60000),
    }),
  );
}

/** Origen del console (variable obligatoria: falta → 503). */
export function consoleOrigin(env: Env): string {
  const origin = env.CONSOLE_ORIGIN?.trim();
  if (!origin) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  return origin;
}

/** Origen del storefront: `STORE_ORIGIN_TEMPLATE` con `{slug}` sustituido. */
export function storeOrigin(env: Env, slug: string | null): string {
  const template = env.STORE_ORIGIN_TEMPLATE?.trim();
  if (!template) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  return template.replace("{slug}", slug ?? "");
}
