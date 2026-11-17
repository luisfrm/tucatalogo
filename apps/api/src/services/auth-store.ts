/**
 * Autenticación de tienda (PLAN §4.5 B / §7.2 / §7.6).
 *
 * La tienda **siempre** se resuelve en servidor a partir de la cabecera
 * interna `x-store-slug`, que fija el worker que atiende el host. Ni el body ni
 * el query (`?siteId`, B1) pueden elegir tienda. La sesión debe ser del dueño
 * (`store.owner_id === user.id`); si no, 403 sin emitir cookie.
 */
import type { Database } from "@tucatalogo/db";
import { getSlugRejectionReason, normalizeSlugInput } from "@tucatalogo/shared";
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  StoreLoginInput,
  StoreSessionResponse,
} from "@tucatalogo/types";

import { AUTH_HEADERS, AUTH_MESSAGES, AUTH_REASONS, SESSION_POLICY } from "../constants/auth";
import type { Env } from "../env";
import { AppError } from "../errors";
import {
  deleteStoreSessionByToken,
  findStoreBySlug,
  type StoreRow,
} from "../repositories/auth-store";
import { assertRateLimit } from "./rate-limit";
import { hashEmail, hashIp } from "../libs/crypto";
import { asSessionExpiry, asSessionUser, callAuthEndpoint, toAppError, AuthEndpointError, toAuthHeaders } from "../auth/shared";
import type { StoreAuth } from "../auth/store";

export interface ResolvedStore {
  store: StoreRow;
  slug: string;
}

/**
 * Slug de la tienda según la cabecera interna. El frontend debe
 * **sobrescribir** `x-store-slug` con el host real (nunca reenviar el valor del
 * navegador). Cualquier intento de resolver la tienda por query (B1) se ignora.
 */
export function resolveStoreSlug(headers: Headers): string | null {
  return headers.get(AUTH_HEADERS.storeSlug);
}

export async function resolveStore(
  db: Database,
  headers: Headers,
): Promise<ResolvedStore> {
  const raw = resolveStoreSlug(headers);
  if (!raw) {
    throw new AppError(
      "VALIDATION_ERROR",
      AUTH_MESSAGES.storeSlugMissing,
      undefined,
      AUTH_REASONS.storeSlugMissing,
    );
  }

  const slug = normalizeSlugInput(raw);
  if (getSlugRejectionReason(slug) !== null) {
    throw new AppError(
      "VALIDATION_ERROR",
      AUTH_MESSAGES.storeSlugInvalid,
      undefined,
      AUTH_REASONS.storeSlugInvalid,
    );
  }

  const store = await findStoreBySlug(db, slug);
  if (!store) {
    throw new AppError("NOT_FOUND", AUTH_MESSAGES.storeNotFound, undefined, AUTH_REASONS.storeNotFound);
  }
  return { store, slug };
}

export interface StoreLoginResult {
  session: StoreSessionResponse;
  setCookies: string[];
}

/** `POST /auth/store/login`. */
export async function loginStore(
  env: Env,
  db: Database,
  auth: StoreAuth,
  input: StoreLoginInput,
  store: StoreRow,
  request: Request,
  ip: string,
): Promise<StoreLoginResult> {
  const secret = env.BETTER_AUTH_SECRET_STORE;
  if (!secret) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }

  await assertRateLimit(
    db,
    "storeLogin",
    `${await hashEmail(secret, input.email)}:${await hashIp(secret, ip)}`,
  );

  const headers = toAuthHeaders(request, ip);

  let result;
  try {
    result = await callAuthEndpoint<{ token?: string; user?: { id: string; email: string; name: string } }>(
      auth.api.signInEmail({
        body: { email: input.email, password: input.password, rememberMe: true },
        headers,
        asResponse: true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      throw toAppError(error, AUTH_MESSAGES.invalidCredentials, AUTH_REASONS.invalidCredentials);
    }
    throw error;
  }

  const user = result.data?.user;
  if (!user?.id) {
    throw new AppError("UNAUTHORIZED", AUTH_MESSAGES.invalidCredentials, undefined, AUTH_REASONS.invalidCredentials);
  }

  if (store.ownerId !== user.id) {
    // Better Auth ya creó una sesión: se revoca para no dejar un token válido
    // y **no** se reenvía su `Set-Cookie`.
    if (result.data?.token) {
      await deleteStoreSessionByToken(db, result.data.token);
    }
    throw new AppError("FORBIDDEN", AUTH_MESSAGES.storeMismatch, undefined, AUTH_REASONS.storeMismatch);
  }

  return {
    session: {
      user: { id: user.id, name: user.name, email: user.email },
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
        status: store.status,
      },
      expiresAt: new Date(
        Date.now() + SESSION_POLICY.store.expiresInSeconds * 1000,
      ).toISOString(),
    },
    setCookies: result.setCookies,
  };
}

export interface StoreSessionResult {
  session: StoreSessionResponse;
  setCookies: string[];
}

/** `GET /auth/store/session`: sesión + tienda para el loader del panel. */
export async function readStoreSession(
  auth: StoreAuth,
  store: StoreRow,
  request: Request,
  ip: string,
): Promise<StoreSessionResult | null> {
  const result = await callAuthEndpoint<unknown>(
    auth.api.getSession({ headers: toAuthHeaders(request, ip), asResponse: true }),
  );

  const user = asSessionUser(result.data);
  if (!user) return null;

  if (store.ownerId !== user.id) {
    throw new AppError("FORBIDDEN", AUTH_MESSAGES.storeMismatch, undefined, AUTH_REASONS.storeMismatch);
  }

  return {
    session: {
      user: { id: user.id, name: user.name, email: user.email },
      store: { id: store.id, slug: store.slug, name: store.name, status: store.status },
      expiresAt: asSessionExpiry(result.data),
    },
    setCookies: result.setCookies,
  };
}

/** `POST /auth/store/logout`: invalida la fila de sesión y borra la cookie. */
export async function logoutStore(
  auth: StoreAuth,
  request: Request,
  ip: string,
): Promise<string[]> {
  const result = await callAuthEndpoint<{ success?: boolean }>(
    auth.api.signOut({ headers: toAuthHeaders(request, ip), asResponse: true }),
  );
  return result.setCookies;
}

/** `POST /auth/store/password/forgot`: misma respuesta exista o no el email. */
export async function requestStorePasswordReset(
  env: Env,
  db: Database,
  auth: StoreAuth,
  input: ForgotPasswordInput,
  request: Request,
  ip: string,
): Promise<void> {
  const secret = env.BETTER_AUTH_SECRET_STORE;
  if (!secret) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }

  await assertRateLimit(
    db,
    "passwordResetByEmail",
    `${await hashEmail(secret, input.email)}`,
  );
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
    // El endpoint real ya responde igual para emails inexistentes; si aun así
    // falla por validación, la respuesta sigue siendo la misma para el cliente.
  }
}

/** `POST /auth/store/password/reset`. */
export async function resetStorePassword(
  env: Env,
  db: Database,
  auth: StoreAuth,
  input: ResetPasswordInput,
  request: Request,
  ip: string,
): Promise<void> {
  const secret = env.BETTER_AUTH_SECRET_STORE;
  if (!secret) {
    throw new AppError("SERVICE_UNAVAILABLE", AUTH_MESSAGES.configMissing);
  }
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
