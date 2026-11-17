/**
 * Instancia Better Auth del reino **console** (PLAN §7.1 / §7.5).
 *
 * - Drizzle/D1 sobre `admin_users|sessions|accounts|verifications|two_factor`.
 * - Email + contraseña + plugin `twoFactor` (TOTP + backup codes de un solo uso).
 * - Cookie host-only `console.*`, secreto propio.
 * - Sesión de 8 h sin renovación silenciosa (`disableSessionRefresh`).
 * - `revokeSessionsOnPasswordReset`: el reset invalida sesiones y **no** salta
 *   el 2FA; el siguiente login vuelve a pedir el segundo factor.
 */
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";

import { createDb } from "@tucatalogo/db";
import {
  adminAccounts,
  adminSessions,
  adminTwoFactor,
  adminUsers,
  adminVerifications,
} from "@tucatalogo/db/schema";

import {
  AUTH_BASE_PATH,
  COOKIE_PREFIX,
  INTERNAL_AUTH_ORIGIN,
  SESSION_POLICY,
} from "../constants/auth";
import type { Env } from "../env";
import { consoleOrigin, sendPasswordResetEmail } from "../services/auth-email";
import { createAuthLogger, isLocalEnv, requireAuthSecret } from "./shared";

export type ConsoleAuth = ReturnType<typeof createConsoleAuth>;

export function createConsoleAuth(env: Env) {
  const db = createDb(env.DB);
  const secure = !isLocalEnv(env);

  return betterAuth({
    appName: "TuCatálogo Console",
    secret: requireAuthSecret(env, "console"),
    baseURL: INTERNAL_AUTH_ORIGIN,
    basePath: AUTH_BASE_PATH.console,
    trustedOrigins: [INTERNAL_AUTH_ORIGIN],
    logger: createAuthLogger("console"),
    rateLimit: { enabled: false },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      transaction: false,
      schema: {
        user: adminUsers,
        session: adminSessions,
        account: adminAccounts,
        verification: adminVerifications,
        twoFactor: adminTwoFactor,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        await sendPasswordResetEmail(env, {
          realm: "console",
          to: user.email,
          origin: consoleOrigin(env),
          token,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
    },
    session: {
      expiresIn: SESSION_POLICY.console.expiresInSeconds,
      updateAge: SESSION_POLICY.console.updateAgeSeconds,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    plugins: [
      twoFactor({
        issuer: "TuCatálogo Console",
        // TOTP obligatorio: 30 s por código, 6 dígitos (estándar RFC 6238).
        totpOptions: { digits: 6, period: 30 },
        backupCodeOptions: { amount: 10, length: 10 },
        // Un challenge de 2FA vive 10 minutos; sin "recordar dispositivo" en el
        // MVP (cada sesión nueva exige código).
        twoFactorCookieMaxAge: 10 * 60,
        accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 15 * 60 },
      }),
    ],
    advanced: {
      cookiePrefix: COOKIE_PREFIX.console,
      useSecureCookies: secure,
      disableCSRFCheck: false,
      disableOriginCheck: false,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
  });
}
