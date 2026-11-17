/**
 * Instancia Better Auth del reino **tienda** (PLAN §7.1).
 *
 * - Drizzle/D1 sobre `store_users|sessions|accounts|verifications`.
 * - Email + contraseña, reset por enlace de un solo uso.
 * - Cookie host-only `store.*` (con `__Secure-` fuera de local), sin `domain`.
 * - Sin 2FA: el dueño no lo usa en el MVP.
 * - `requireEmailVerification: true` es seguro porque el usuario se crea ya
 *   verificado en el POST final del registro (el OTP prueba el email).
 */
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";

import { createDb } from "@tucatalogo/db";
import {
  storeAccounts,
  storeSessions,
  storeUsers,
  storeVerifications,
} from "@tucatalogo/db/schema";

import {
  AUTH_BASE_PATH,
  COOKIE_PREFIX,
  INTERNAL_AUTH_ORIGIN,
  SESSION_POLICY,
} from "../constants/auth";
import type { Env } from "../env";
import { findStoreByOwnerId } from "../repositories/auth-store";
import { sendPasswordResetEmail, storeOrigin } from "../services/auth-email";
import { createAuthLogger, isLocalEnv, requireAuthSecret } from "./shared";

export type StoreAuth = ReturnType<typeof createStoreAuth>;

export function createStoreAuth(env: Env) {
  const db = createDb(env.DB);
  const secure = !isLocalEnv(env);

  return betterAuth({
    appName: "TuCatálogo",
    secret: requireAuthSecret(env, "store"),
    baseURL: INTERNAL_AUTH_ORIGIN,
    basePath: AUTH_BASE_PATH.store,
    trustedOrigins: [INTERNAL_AUTH_ORIGIN],
    logger: createAuthLogger("store"),
    // §7.7 se implementa en D1 (route + counter): el rate limit interno de la
    // librería queda apagado para no tener dos fuentes de verdad.
    rateLimit: { enabled: false },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      transaction: false,
      schema: {
        user: storeUsers,
        session: storeSessions,
        account: storeAccounts,
        verification: storeVerifications,
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
        // El enlace de reset de tienda vive en el host de la tienda: hay que
        // resolver su slug. Sin tienda no se inventa un host (log de error).
        const store = await findStoreByOwnerId(db, user.id);
        if (!store) {
          console.error(
            JSON.stringify({
              level: "error",
              message: "Reset de tienda sin tienda asociada",
              userId: user.id,
            }),
          );
          return;
        }
        await sendPasswordResetEmail(env, {
          realm: "store",
          to: user.email,
          origin: storeOrigin(env, store.slug),
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
      expiresIn: SESSION_POLICY.store.expiresInSeconds,
      updateAge: SESSION_POLICY.store.updateAgeSeconds,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: COOKIE_PREFIX.store,
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
