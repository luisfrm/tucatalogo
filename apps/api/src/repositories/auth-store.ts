/**
 * Repositorio del reino tienda (PLAN §6.3). Drizzle/D1 solo aquí.
 *
 * El registro crea `store_users` + `store_accounts` + `store` y consume el
 * `signup_intent` en **un único `batch`** de D1 (atómico): nunca queda un
 * usuario sin tienda ni una tienda sin dueño.
 */
import { and, eq, isNull } from "@tucatalogo/db";

import type { Database } from "@tucatalogo/db";
import {
  signupIntents,
  storeSessions,
  stores,
  storeAccounts,
  storeUsers,
  type Currency,
} from "@tucatalogo/db/schema";

export interface StoreRow {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  status: "pending" | "active" | "suspended";
  themeId: string;
  primaryColor: string;
  colorModeDefault: "light" | "dark";
  currency: string;
  plan: string;
  suspendedBy: "owner" | "admin" | null;
  whatsappNumber: string | null;
  whatsappMessageTemplate: string | null;
  logoKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreUserRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function findStoreBySlug(db: Database, slug: string): Promise<StoreRow | null> {
  const rows = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  return (rows[0] as StoreRow | undefined) ?? null;
}

export async function findStoreByOwnerId(db: Database, ownerId: string): Promise<StoreRow | null> {
  const rows = await db.select().from(stores).where(eq(stores.ownerId, ownerId)).limit(1);
  return (rows[0] as StoreRow | undefined) ?? null;
}

export async function findStoreUserById(
  db: Database,
  userId: string,
): Promise<StoreUserRow | null> {
  const rows = await db
    .select({
      id: storeUsers.id,
      email: storeUsers.email,
      name: storeUsers.name,
      emailVerified: storeUsers.emailVerified,
    })
    .from(storeUsers)
    .where(eq(storeUsers.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export interface CreateStoreWithOwnerInput {
  now: Date;
  intentId: string;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  account: {
    id: string;
    passwordHash: string;
  };
  store: {
    id: string;
    slug: string;
    name: string;
    status: "pending" | "active" | "suspended";
    themeId: string;
    primaryColor: string;
    colorModeDefault: "light" | "dark";
    currency: Currency;
    plan: string;
    whatsappNumber: string | null;
    whatsappMessageTemplate: string;
  };
}

/**
 * Escritura atómica del registro final. Las constraints únicas
 * (`store_users.email`, `store.slug`, `store.owner_id`) son la última palabra:
 * si otro registro ganó la carrera, D1 aborta el batch completo y el service
 * traduce el fallo a 409.
 */
export async function createStoreWithOwner(
  db: Database,
  input: CreateStoreWithOwnerInput,
): Promise<void> {
  const { now, user, account, store } = input;

  await db.batch([
    // El intent solo se consume si sigue libre: si ya se usó, no hay updates
    // y el service lo detecta con el `returning` de su propia comprobación.
    db
      .update(signupIntents)
      .set({ consumedAt: now })
      .where(and(eq(signupIntents.id, input.intentId), isNull(signupIntents.consumedAt))),
    db.insert(storeUsers).values({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(storeAccounts).values({
      id: account.id,
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: account.passwordHash,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(stores).values({
      id: store.id,
      ownerId: user.id,
      slug: store.slug,
      name: store.name,
      status: store.status,
      themeId: store.themeId,
      primaryColor: store.primaryColor,
      colorModeDefault: store.colorModeDefault,
      currency: store.currency,
      plan: store.plan,
      whatsappNumber: store.whatsappNumber,
      whatsappMessageTemplate: store.whatsappMessageTemplate,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

/**
 * Borra la sesión por token. Se usa para no dejar viva una sesión creada por
 * Better Auth antes de comprobar que el usuario es dueño de la tienda.
 */
export async function deleteStoreSessionByToken(db: Database, token: string): Promise<void> {
  await db.delete(storeSessions).where(eq(storeSessions.token, token));
}
