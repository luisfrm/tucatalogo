/**
 * Repositorio del registro (PLAN §6.4 / §7.3): `signup_intent` y comprobación
 * de disponibilidad de slug/email. Drizzle/D1 solo aquí.
 */
import { and, desc, eq, gt, isNull, lt, sql } from "@tucatalogo/db";

import type { Database } from "@tucatalogo/db";
import { signupIntents, slugReservations, stores, storeUsers } from "@tucatalogo/db/schema";

export interface SignupIntentRecord {
  id: string;
  email: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  consumedAt: Date | null;
  ipHash: string | null;
  createdAt: Date;
}

/** Intent vigente (no consumido) más reciente para un email. */
export async function findActiveSignupIntent(
  db: Database,
  email: string,
): Promise<SignupIntentRecord | null> {
  const rows = await db
    .select()
    .from(signupIntents)
    .where(and(eq(signupIntents.email, email), isNull(signupIntents.consumedAt)))
    .orderBy(desc(signupIntents.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Crea un intent nuevo e invalida los anteriores del mismo email en un solo
 * `batch` (atómico en D1): un código viejo nunca sigue siendo válido.
 */
export async function replaceSignupIntent(
  db: Database,
  record: SignupIntentRecord,
): Promise<void> {
  await db.batch([
    db
      .update(signupIntents)
      .set({ consumedAt: record.createdAt })
      .where(and(eq(signupIntents.email, record.email), isNull(signupIntents.consumedAt))),
    db.insert(signupIntents).values({
      id: record.id,
      email: record.email,
      otpHash: record.otpHash,
      attempts: record.attempts,
      expiresAt: record.expiresAt,
      lastSentAt: record.lastSentAt,
      consumedAt: null,
      ipHash: record.ipHash,
      createdAt: record.createdAt,
    }),
  ]);
}

/** Suma un intento fallido y devuelve el total (5 = intent inválido). */
export async function incrementSignupIntentAttempts(
  db: Database,
  intentId: string,
): Promise<number> {
  const rows = await db
    .update(signupIntents)
    .set({ attempts: sql`${signupIntents.attempts} + 1` })
    .where(eq(signupIntents.id, intentId))
    .returning({ attempts: signupIntents.attempts });
  return rows[0]?.attempts ?? 0;
}

/** Consume el intent (un solo uso). Devuelve `false` si ya estaba consumido. */
export async function consumeSignupIntent(
  db: Database,
  intentId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(signupIntents)
    .set({ consumedAt: now })
    .where(and(eq(signupIntents.id, intentId), isNull(signupIntents.consumedAt)))
    .returning({ id: signupIntents.id });
  return rows.length === 1;
}

/** Purga de intents caducados (script de mantenimiento / tests). */
export async function deleteExpiredSignupIntents(db: Database, before: Date): Promise<void> {
  await db.delete(signupIntents).where(lt(signupIntents.expiresAt, before));
}

/** `store.slug` ocupado (incluye suspendidas: el slug sigue tomado). */
export async function isSlugTaken(db: Database, slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/** ¿Hay una cuarentena vigente para el slug? */
export async function hasActiveSlugReservation(
  db: Database,
  slug: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .select({ id: slugReservations.id })
    .from(slugReservations)
    .where(and(eq(slugReservations.slug, slug), gt(slugReservations.reservedUntil, now)))
    .limit(1);
  return rows.length > 0;
}

/** Email ya registrado en el reino tienda. */
export async function isStoreEmailTaken(db: Database, email: string): Promise<boolean> {
  const rows = await db
    .select({ id: storeUsers.id })
    .from(storeUsers)
    .where(eq(storeUsers.email, email))
    .limit(1);
  return rows.length > 0;
}
