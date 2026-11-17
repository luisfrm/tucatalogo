/**
 * Autenticación del console (PLAN §4.5 C/F, §7.4, §7.5, §7.6).
 *
 * - `/init` es one-time: si ya hay un admin → **410** exista o no el token.
 *   `INIT_TOKEN` vive solo en el api y se compara en tiempo constante.
 * - **M1:** ninguna respuesta emite cookie de sesión antes de verificar el
 *   segundo factor. `/init`, `/2fa/setup` y `login` devuelven un *challenge de
 *   enrolamiento* propio (token de un solo uso, 10 min, hasheado en
 *   `admin_verifications`) y, como mucho, la cookie `two_factor` de Better
 *   Auth. La cookie de sesión sale **solo** de `/2fa/verify` tras un TOTP o
 *   backup code correcto.
 * - Una sesión de console exige además `admin_two_factor.verified = 1`.
 * - El reset de contraseña **no** salta el 2FA: revoca sesiones y el siguiente
 *   login vuelve a pedir el segundo factor.
 */
import type { Database } from "@tucatalogo/db";
import type {
  ConsoleInitInput,
  ConsoleInitResponse,
  ConsoleLoginInput,
  ConsoleLoginResponse,
  ForgotPasswordInput,
  ResetPasswordInput,
  TwoFactorSetupResponse,
  TwoFactorVerifyInput,
} from "@tucatalogo/types";
import { hashPassword } from "better-auth/crypto";

import {
  asSessionUser,
  asSessionExpiry,
  AuthEndpointError,
  callAuthEndpoint,
  cookiesToHeader,
  toAppError,
  toAuthHeaders,
} from "../auth/shared";
import type { ConsoleAuth } from "../auth/console";
import { createTransientConsoleSession } from "../auth/transient-session";
import { AUTH_MESSAGES, AUTH_REASONS, CONSOLE_ENROLLMENT } from "../constants/auth";
import type { Env } from "../env";
import { AppError } from "../errors";
import { hashEmail, hashIp, randomToken, sha256Hex, timingSafeEqual } from "../libs/crypto";
import {
  consumeEnrollmentChallenge,
  countAdmins,
  createAdmin,
  createEnrollmentChallenge,
  deleteAdmin,
  deleteAdminSessionByToken,
  deleteEnrollmentChallenges,
  findAdminByEmail,
  findAdminById,
  findEnrollmentChallenge,
  insertAuditLog,
  isTwoFactorVerified,
} from "../repositories/auth-console";
import { assertRateLimit } from "./rate-limit";

function requireConsoleSecret(env: Env): string {
  const secret = env.BETTER_AUTH_SECRET_CONSOLE;
  if (!secret || secret.length < 16) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Falta BETTER_AUTH_SECRET_CONSOLE",
      }),
    );
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
  return secret;
}

function consumedError(): AppError {
  return new AppError(
    "GONE",
    AUTH_MESSAGES.initConsumed,
    undefined,
    AUTH_REASONS.initConsumed,
  );
}

function enrollmentInvalidError(): AppError {
  return new AppError(
    "UNAUTHORIZED",
    AUTH_MESSAGES.enrollmentInvalid,
    undefined,
    AUTH_REASONS.enrollmentTokenInvalid,
  );
}

function alreadyEnabledError(): AppError {
  return new AppError(
    "CONFLICT",
    AUTH_MESSAGES.twoFactorAlreadyEnabled,
    undefined,
    AUTH_REASONS.twoFactorAlreadyEnabled,
  );
}

/**
 * Emite un challenge de enrolamiento: token opaco → hash en
 * `admin_verifications`. Sustituye a cualquier challenge previo del admin.
 */
async function issueEnrollmentChallenge(
  db: Database,
  adminId: string,
  now: Date,
): Promise<string> {
  await deleteEnrollmentChallenges(db, adminId);
  const token = randomToken();
  await createEnrollmentChallenge(db, {
    tokenHash: await sha256Hex(token),
    adminId,
    expiresAt: new Date(now.getTime() + CONSOLE_ENROLLMENT.ttlMs),
    now,
  });
  return token;
}

/** Auditoría de login del console: nunca email, contraseña ni código. */
async function recordLoginAudit(
  db: Database,
  input: {
    action: "admin.login" | "admin.login_failed";
    adminId: string | null;
    ipHash: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await insertAuditLog(db, {
    id: crypto.randomUUID(),
    actorType: input.adminId ? "admin" : "system",
    actorId: input.adminId,
    action: input.action,
    targetType: "admin",
    targetId: input.adminId,
    metadata: input.metadata,
    ipHash: input.ipHash,
    now: new Date(),
  });
}

/** `GET /auth/console/init-status`. */
export async function getInitStatus(db: Database): Promise<{ available: boolean }> {
  return { available: (await countAdmins(db)) === 0 };
}

export interface ConsoleInitResult {
  response: ConsoleInitResponse;
}

/**
 * `POST /auth/console/init`: crea el admin y devuelve el secreto TOTP, los
 * backup codes y el challenge de enrolamiento. **Sin `Set-Cookie`** (M1).
 */
export async function initConsole(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: ConsoleInitInput,
  request: Request,
  ip: string,
): Promise<ConsoleInitResult> {
  if ((await countAdmins(db)) > 0) {
    throw consumedError();
  }

  const initToken = env.INIT_TOKEN;
  if (!initToken) {
    console.error(JSON.stringify({ level: "error", message: "Falta INIT_TOKEN" }));
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }

  const secret = requireConsoleSecret(env);
  const ipHash = await hashIp(secret, ip);
  await assertRateLimit(db, "consoleInitByIp", ipHash);

  if (!timingSafeEqual(initToken, input.initToken)) {
    throw new AppError(
      "UNAUTHORIZED",
      "El token de alta no es correcto.",
      undefined,
      AUTH_REASONS.initTokenInvalid,
    );
  }

  const now = new Date();
  const adminId = crypto.randomUUID();
  await createAdmin(db, {
    now,
    user: { id: adminId, email: input.email, name: input.name, emailVerified: true },
    account: { id: crypto.randomUUID(), passwordHash: await hashPassword(input.password) },
  });

  // Carrera de dos `/init` simultáneos: gana uno; el otro deshace su escritura.
  if ((await countAdmins(db)) !== 1) {
    await deleteAdmin(db, adminId);
    throw consumedError();
  }

  try {
    const signIn = await callAuthEndpoint<{ token?: string }>(
      auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: toAuthHeaders(request, ip),
        asResponse: true,
      }),
    );

    // La sesión de este sign-in es transitoria: solo sirve para crear el
    // secreto TOTP. Nunca se reenvía al cliente y se revoca al terminar.
    const enrollmentCookie = cookiesToHeader(signIn.setCookies);
    const sessionToken = signIn.data?.token;

    try {
      const enable = await callAuthEndpoint<{
        totpURI?: string;
        backupCodes?: string[];
      }>(
        auth.api.enableTwoFactor({
          body: { password: input.password, method: "totp" },
          headers: withCookie(toAuthHeaders(request, ip), enrollmentCookie),
          asResponse: true,
        }),
      );

      if (!enable.data?.totpURI || !enable.data.backupCodes) {
        throw new AppError("INTERNAL", "No pudimos activar el 2FA. Inténtalo de nuevo.");
      }

      const enrollmentToken = await issueEnrollmentChallenge(db, adminId, now);

      await insertAuditLog(db, {
        id: crypto.randomUUID(),
        actorType: "admin",
        actorId: adminId,
        action: "admin.init",
        targetType: "admin",
        targetId: adminId,
        // Sin PII en `metadata`: el email ya está en `admin_users`.
        metadata: { source: "init" },
        ipHash,
        now,
      });

      return {
        response: {
          admin: { id: adminId, name: input.name, email: input.email },
          backupCodes: enable.data.backupCodes,
          totpUri: enable.data.totpURI,
          enrollmentRequired: true,
          enrollmentToken,
        },
      };
    } finally {
      // Sin cookie de sesión en la respuesta: la fila tampoco debe sobrevivir.
      if (sessionToken) await deleteAdminSessionByToken(db, sessionToken).catch(() => undefined);
    }
  } catch (error) {
    // Sin admin no queda acceso abierto ni un email bloqueado para reintentar.
    await deleteAdmin(db, adminId).catch(() => undefined);
    if (error instanceof AuthEndpointError) {
      throw toAppError(error, "No pudimos crear el administrador.");
    }
    throw error;
  }
}

function withCookie(headers: Headers, cookie: string): Headers {
  const next = new Headers(headers);
  next.set("cookie", cookie);
  return next;
}

export interface ConsoleLoginResult {
  response: ConsoleLoginResponse;
  setCookies: string[];
}

/**
 * `POST /auth/console/login`: contraseña → challenge de 2FA o challenge de
 * enrolamiento propio. Nunca devuelve una cookie de sesión (M1).
 */
export async function loginConsole(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: ConsoleLoginInput,
  request: Request,
  ip: string,
): Promise<ConsoleLoginResult> {
  const secret = requireConsoleSecret(env);
  const ipHash = await hashIp(secret, ip);
  await assertRateLimit(
    db,
    "consoleLogin",
    `${await hashEmail(secret, input.email)}:${ipHash}`,
  );

  let result;
  try {
    result = await callAuthEndpoint<{ twoFactorRedirect?: boolean; token?: string }>(
      auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: toAuthHeaders(request, ip),
        asResponse: true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      const admin = await findAdminByEmail(db, input.email).catch(() => null);
      await recordLoginAudit(db, {
        action: "admin.login_failed",
        adminId: admin?.id ?? null,
        ipHash,
        metadata: { stage: "password" },
      }).catch((auditError: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            message: "No se pudo auditar el login fallido del console",
            error: auditError instanceof Error ? auditError.message : String(auditError),
          }),
        );
      });
      throw toAppError(error, AUTH_MESSAGES.invalidCredentials, AUTH_REASONS.invalidCredentials);
    }
    throw error;
  }

  if (result.data?.twoFactorRedirect) {
    // Cookie `two_factor` de Better Auth (10 min). No hay sesión todavía.
    return {
      response: { admin: null, twoFactorRequired: true, enrollmentRequired: false },
      setCookies: result.setCookies,
    };
  }

  const user = asSessionUser(result.data);
  if (!user) {
    throw new AppError(
      "UNAUTHORIZED",
      AUTH_MESSAGES.invalidCredentials,
      undefined,
      AUTH_REASONS.invalidCredentials,
    );
  }

  // Better Auth creó una sesión porque el 2FA aún no está verificado: se
  // revoca y se sustituye por un challenge de enrolamiento (M1).
  if (result.data?.token) {
    await deleteAdminSessionByToken(db, result.data.token);
  }
  const enrollmentToken = await issueEnrollmentChallenge(db, user.id, new Date());

  return {
    response: {
      admin: { id: user.id, name: user.name, email: user.email },
      twoFactorRequired: true,
      enrollmentRequired: true,
      enrollmentToken,
    },
    setCookies: [],
  };
}

export interface ConsoleSessionResult {
  response: {
    admin: { id: string; name: string; email: string; twoFactorEnabled: true };
    expiresAt: string;
  };
  setCookies: string[];
}

/**
 * ¿La sesión de este admin está plenamente habilitada? `twoFactorEnabled` lo
 * escribe Better Auth; `admin_two_factor.verified` es la comprobación extra de
 * M1 (una fila a medio enrolar no abre el console).
 */
async function assertFullyVerified(db: Database, adminId: string): Promise<void> {
  if (!(await isTwoFactorVerified(db, adminId))) {
    throw new AppError(
      "FORBIDDEN",
      AUTH_MESSAGES.twoFactorRequired,
      undefined,
      AUTH_REASONS.twoFactorRequired,
    );
  }
}

/** `GET /auth/console/session`: exige sesión **con 2FA verificado**. */
export async function readConsoleSession(
  db: Database,
  auth: ConsoleAuth,
  request: Request,
  ip: string,
): Promise<ConsoleSessionResult | null> {
  const result = await callAuthEndpoint<unknown>(
    auth.api.getSession({ headers: toAuthHeaders(request, ip), asResponse: true }),
  );

  const user = asSessionUser(result.data);
  if (!user) return null;

  if (!user.twoFactorEnabled) {
    throw new AppError(
      "FORBIDDEN",
      AUTH_MESSAGES.twoFactorRequired,
      undefined,
      AUTH_REASONS.twoFactorRequired,
    );
  }
  await assertFullyVerified(db, user.id);

  return {
    response: {
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        twoFactorEnabled: true,
      },
      expiresAt: asSessionExpiry(result.data),
    },
    setCookies: result.setCookies,
  };
}

/** `POST /auth/console/logout`. */
export async function logoutConsole(
  auth: ConsoleAuth,
  request: Request,
  ip: string,
): Promise<string[]> {
  const result = await callAuthEndpoint<{ success?: boolean }>(
    auth.api.signOut({ headers: toAuthHeaders(request, ip), asResponse: true }),
  );
  return result.setCookies;
}

export interface ConsoleTwoFactorSetupResult {
  response: TwoFactorSetupResponse;
}

/**
 * `POST /auth/console/2fa/setup`: (re)genera el secreto TOTP con la contraseña
 * y devuelve un challenge de enrolamiento. **Sin `Set-Cookie`** (M1).
 */
export async function setupConsoleTwoFactor(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: { email: string; password: string },
  request: Request,
  ip: string,
): Promise<ConsoleTwoFactorSetupResult> {
  const secret = requireConsoleSecret(env);
  await assertRateLimit(db, "consoleTwoFactor", await hashIp(secret, ip));

  let signIn;
  try {
    signIn = await callAuthEndpoint<{ twoFactorRedirect?: boolean; token?: string }>(
      auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: toAuthHeaders(request, ip),
        asResponse: true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      throw new AppError(
        "UNAUTHORIZED",
        AUTH_MESSAGES.invalidCredentials,
        undefined,
        AUTH_REASONS.invalidCredentials,
      );
    }
    throw error;
  }

  // Ya hay un 2FA verificado: no se puede volver a enrolar sin un código.
  if (signIn.data?.twoFactorRedirect) {
    throw alreadyEnabledError();
  }

  const user = asSessionUser(signIn.data);
  if (!user) {
    throw new AppError(
      "UNAUTHORIZED",
      AUTH_MESSAGES.invalidCredentials,
      undefined,
      AUTH_REASONS.invalidCredentials,
    );
  }
  if (await isTwoFactorVerified(db, user.id)) {
    throw alreadyEnabledError();
  }

  const enrollmentCookie = cookiesToHeader(signIn.setCookies);
  try {
    const enable = await callAuthEndpoint<{ totpURI?: string; backupCodes?: string[] }>(
      auth.api.enableTwoFactor({
        body: { password: input.password, method: "totp" },
        headers: withCookie(toAuthHeaders(request, ip), enrollmentCookie),
        asResponse: true,
      }),
    );

    if (!enable.data?.totpURI || !enable.data.backupCodes) {
      throw new AppError("INTERNAL", "No pudimos activar el 2FA. Inténtalo de nuevo.");
    }

    const enrollmentToken = await issueEnrollmentChallenge(db, user.id, new Date());
    return {
      response: {
        totpUri: enable.data.totpURI,
        backupCodes: enable.data.backupCodes,
        enrollmentToken,
      },
    };
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      if (error.authCode === "TOTP_ALREADY_ENABLED") throw alreadyEnabledError();
      if (error.authCode === "INVALID_PASSWORD") {
        throw new AppError(
          "UNAUTHORIZED",
          AUTH_MESSAGES.invalidPassword,
          undefined,
          AUTH_REASONS.invalidPassword,
        );
      }
      throw toAppError(error, "No pudimos activar el 2FA.");
    }
    throw error;
  } finally {
    if (signIn.data?.token) {
      await deleteAdminSessionByToken(db, signIn.data.token).catch(() => undefined);
    }
  }
}

/**
 * `POST /auth/console/2fa/verify`: TOTP o backup code.
 *
 * - Con `enrollmentToken`: enrolamiento pendiente. Se crea una sesión
 *   **transitoria** de servidor para que Better Auth verifique el código,
 *   marque `verified = 1` y emita la sesión real.
 * - Sin `enrollmentToken`: challenge `two_factor` del login normal; Better Auth
 *   crea la sesión al validar el código.
 *
 * En ambos casos la cookie de sesión se emite aquí y solo aquí (M1).
 */
export async function verifyConsoleTwoFactor(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: TwoFactorVerifyInput,
  request: Request,
  ip: string,
): Promise<string[]> {
  const secret = requireConsoleSecret(env);
  const ipHash = await hashIp(secret, ip);
  const enrollmentToken = input.enrollmentToken;

  if (enrollmentToken) {
    // 5 intentos por challenge: el token es de un solo uso y corto.
    const tokenHash = await sha256Hex(enrollmentToken);
    await assertRateLimit(db, "consoleTwoFactor", tokenHash);

    // Se busca sin consumir: un código mal tecleado no quema el enrolamiento.
    const adminId = await findEnrollmentChallenge(db, tokenHash, new Date());
    if (!adminId) throw enrollmentInvalidError();
    if (!(await findAdminById(db, adminId))) throw enrollmentInvalidError();
    if (await isTwoFactorVerified(db, adminId)) throw alreadyEnabledError();

    const transient = await createTransientConsoleSession(auth, {
      userId: adminId,
      ip,
      userAgent: request.headers.get("user-agent") ?? "",
    });

    try {
      const result = await callAuthEndpoint<unknown>(
        callVerify(auth, input, withCookie(toAuthHeaders(request, ip), transient.cookieHeader)),
      );
      if (result.setCookies.length === 0) {
        throw new AppError("INTERNAL", "No pudimos emitir la sesión del console.");
      }

      // Un solo uso: si otra petición paralela ya lo consumió, el código TOTP
      // válido sigue siendo prueba suficiente para devolver la sesión.
      await consumeEnrollmentChallenge(db, tokenHash, new Date());

      await recordLoginAudit(db, {
        action: "admin.login",
        adminId,
        ipHash,
        metadata: { stage: "2fa", method: input.type, enrollment: true },
      });

      return result.setCookies;
    } catch (error) {
      // La sesión transitoria no debe sobrevivir a un intento fallido.
      await deleteAdminSessionByToken(db, transient.token).catch(() => undefined);
      if (error instanceof AuthEndpointError) {
        await recordLoginAudit(db, {
          action: "admin.login_failed",
          adminId,
          ipHash,
          metadata: { stage: "2fa", method: input.type, enrollment: true },
        }).catch(() => undefined);
        if (error.status === 429) {
          throw toAppError(error, AUTH_MESSAGES.rateLimited);
        }
        throw new AppError(
          "UNAUTHORIZED",
          AUTH_MESSAGES.twoFactorInvalid,
          undefined,
          AUTH_REASONS.twoFactorInvalid,
        );
      }
      throw error;
    }
  }

  // Login normal: better-auth gestiona el challenge y la sesión.
  await assertRateLimit(db, "consoleTwoFactor", ipHash);
  try {
    const result = await callAuthEndpoint<unknown>(
      callVerify(auth, input, toAuthHeaders(request, ip)),
    );
    const user = asSessionUser(result.data);
    await recordLoginAudit(db, {
      action: "admin.login",
      adminId: user?.id ?? null,
      ipHash,
      metadata: { stage: "2fa", method: input.type, enrollment: false },
    });
    return result.setCookies;
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      await recordLoginAudit(db, {
        action: "admin.login_failed",
        adminId: null,
        ipHash,
        metadata: { stage: "2fa", method: input.type, enrollment: false },
      }).catch(() => undefined);
      if (error.status === 429) {
        throw toAppError(error, AUTH_MESSAGES.rateLimited);
      }
      throw new AppError(
        "UNAUTHORIZED",
        AUTH_MESSAGES.twoFactorInvalid,
        undefined,
        AUTH_REASONS.twoFactorInvalid,
      );
    }
    throw error;
  }
}

function callVerify(
  auth: ConsoleAuth,
  input: TwoFactorVerifyInput,
  headers: Headers,
): Promise<Response> {
  return input.type === "backup"
    ? auth.api.verifyBackupCode({
        body: { code: input.code },
        headers,
        asResponse: true,
      })
    : auth.api.verifyTOTP({
        body: { code: input.code },
        headers,
        asResponse: true,
      });
}

/** `POST /auth/console/password/forgot`: misma respuesta siempre. */
export async function requestConsolePasswordReset(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: ForgotPasswordInput,
  request: Request,
  ip: string,
): Promise<void> {
  const secret = requireConsoleSecret(env);
  await assertRateLimit(db, "passwordResetByEmail", await hashEmail(secret, input.email));
  await assertRateLimit(db, "passwordResetByIp", await hashIp(secret, ip));

  try {
    await callAuthEndpoint(
      auth.api.requestPasswordReset({
        body: { email: input.email },
        headers: toAuthHeaders(request, ip),
        asResponse: true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthEndpointError && error.status >= 500) {
      throw toAppError(error, AUTH_MESSAGES.configMissing);
    }
  }
}

/** `POST /auth/console/password/reset`: no salta el 2FA del siguiente login. */
export async function resetConsolePassword(
  env: Env,
  db: Database,
  auth: ConsoleAuth,
  input: ResetPasswordInput,
  request: Request,
  ip: string,
): Promise<void> {
  const secret = requireConsoleSecret(env);
  // B4: frena la fuerza bruta de tokens inválidos desde una misma IP.
  await assertRateLimit(db, "passwordResetTokenByIp", await hashIp(secret, ip));

  try {
    await callAuthEndpoint(
      auth.api.resetPassword({
        body: { token: input.token, newPassword: input.password },
        headers: toAuthHeaders(request, ip),
        asResponse: true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      throw new AppError(
        "VALIDATION_ERROR",
        "El enlace no es válido o caducó. Pide uno nuevo.",
        undefined,
        "RESET_TOKEN_INVALID",
      );
    }
    throw error;
  }
}
