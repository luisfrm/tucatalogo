/**
 * Repositorio del reino console (PLAN §6.2). Drizzle/D1 solo aquí.
 *
 * `/init` es one-time: la comprobación de "no hay admins" vive en el service y
 * aquí se ofrece la escritura atómica del admin (`admin_users` +
 * `admin_accounts`) para que nunca exista un usuario sin contraseña.
 */
import { and, eq, gt, sql } from "@tucatalogo/db";

import type { Database } from "@tucatalogo/db";
import {
  adminAccounts,
  adminSessions,
  adminTwoFactor,
  adminUsers,
  adminVerifications,
  auditLogs,
} from "@tucatalogo/db/schema";
import { CONSOLE_ENROLLMENT } from "../constants/auth";

export interface AdminRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

/** Número de administradores (0 = `/init` disponible). */
export async function countAdmins(db: Database): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(adminUsers);
  return Number(rows[0]?.count ?? 0);
}

export async function findAdminById(db: Database, adminId: string): Promise<AdminRow | null> {
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      emailVerified: adminUsers.emailVerified,
      twoFactorEnabled: adminUsers.twoFactorEnabled,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findAdminByEmail(db: Database, email: string): Promise<AdminRow | null> {
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      emailVerified: adminUsers.emailVerified,
      twoFactorEnabled: adminUsers.twoFactorEnabled,
    })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export interface CreateAdminInput {
  now: Date;
  user: { id: string; email: string; name: string; emailVerified: boolean };
  account: { id: string; passwordHash: string };
}

/** Crea el admin con su cuenta de credenciales en un `batch` atómico. */
export async function createAdmin(db: Database, input: CreateAdminInput): Promise<void> {
  const { now, user, account } = input;
  await db.batch([
    db.insert(adminUsers).values({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(adminAccounts).values({
      id: account.id,
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: account.passwordHash,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

/**
 * Deshace un `/init` que falló al enrolar el 2FA: sin admin no queda acceso
 * abierto ni un email bloqueado para reintentar.
 */
export async function deleteAdmin(db: Database, adminId: string): Promise<void> {
  await db.batch([
    db.delete(adminSessions).where(eq(adminSessions.userId, adminId)),
    db.delete(adminVerifications).where(
      and(
        eq(adminVerifications.value, adminId),
        sql`${adminVerifications.identifier} like ${`${CONSOLE_ENROLLMENT.prefix}%`}`,
      ),
    ),
    db.delete(adminAccounts).where(eq(adminAccounts.userId, adminId)),
    db.delete(adminUsers).where(eq(adminUsers.id, adminId)),
  ]);
}

/**
 * ¿El 2FA de este admin está **verificado**? `admin_users.two_factor_enabled`
 * lo escribe Better Auth al verificar, pero la fuente de verdad del hallazgo
 * M1 es `admin_two_factor.verified` (una fila a medio enrolar no abre el
 * console).
 */
export async function isTwoFactorVerified(db: Database, adminId: string): Promise<boolean> {
  const rows = await db
    .select({ verified: adminTwoFactor.verified })
    .from(adminTwoFactor)
    .where(eq(adminTwoFactor.userId, adminId))
    .limit(1);
  return rows[0]?.verified === true;
}

/**
 * Challenge de enrolamiento (M1): token propio, hasheado en
 * `admin_verifications`, 10 minutos y un solo uso. Nunca es una sesión: solo
 * autoriza completar el TOTP en `/auth/console/2fa/verify`.
 */
export async function createEnrollmentChallenge(
  db: Database,
  input: { tokenHash: string; adminId: string; expiresAt: Date; now: Date },
): Promise<void> {
  await db.insert(adminVerifications).values({
    id: crypto.randomUUID(),
    identifier: `${CONSOLE_ENROLLMENT.prefix}${input.tokenHash}`,
    value: input.adminId,
    expiresAt: input.expiresAt,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

/**
 * Busca el challenge sin consumirlo (la verificación puede fallar y el usuario
 * debe poder reintentar el código dentro de los 5 intentos del challenge).
 */
export async function findEnrollmentChallenge(
  db: Database,
  tokenHash: string,
  now: Date,
): Promise<string | null> {
  const rows = await db
    .select({ value: adminVerifications.value })
    .from(adminVerifications)
    .where(
      and(
        eq(adminVerifications.identifier, `${CONSOLE_ENROLLMENT.prefix}${tokenHash}`),
        gt(adminVerifications.expiresAt, now),
      ),
    )
    .limit(1);
  return rows[0]?.value ?? null;
}

/**
 * Consume el challenge (un solo uso) y devuelve el `adminId` asociado.
 * `null` si no existe, ya se usó o caducó. Se llama **después** de verificar el
 * código, para que un error de tecleo no obligue a repetir el enrolamiento.
 */
export async function consumeEnrollmentChallenge(
  db: Database,
  tokenHash: string,
  now: Date,
): Promise<string | null> {
  const rows = await db
    .delete(adminVerifications)
    .where(
      and(
        eq(adminVerifications.identifier, `${CONSOLE_ENROLLMENT.prefix}${tokenHash}`),
        gt(adminVerifications.expiresAt, now),
      ),
    )
    .returning({ value: adminVerifications.value });
  return rows[0]?.value ?? null;
}

/** Borra los challenges pendientes de un admin (p. ej. al re-emitir uno). */
export async function deleteEnrollmentChallenges(db: Database, adminId: string): Promise<void> {
  await db
    .delete(adminVerifications)
    .where(
      and(
        eq(adminVerifications.value, adminId),
        sql`${adminVerifications.identifier} like ${`${CONSOLE_ENROLLMENT.prefix}%`}`,
      ),
    );
}

export async function deleteAdminSessionByToken(db: Database, token: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export interface AuditLogInput {
  id: string;
  actorType: "admin" | "owner" | "system";
  actorId: string | null;
  storeId?: string | null;
  storeSlug?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
  now: Date;
}

/** Append-only (PLAN §6.11): nunca se actualiza ni se borra desde aquí. */
export async function insertAuditLog(db: Database, input: AuditLogInput): Promise<void> {
  await db.insert(auditLogs).values({
    id: input.id,
    actorType: input.actorType,
    actorId: input.actorId,
    storeId: input.storeId ?? null,
    storeSlug: input.storeSlug ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    ipHash: input.ipHash ?? null,
    createdAt: input.now,
  });
}
