/**
 * Repositorio de la tienda (PLAN §6.5 / §6.13). Drizzle/D1 solo aquí.
 *
 * El `storeId` siempre llega resuelto por el servidor. Ninguna consulta de este
 * fichero acepta un id que venga del cliente sin pasar por la sesión o el slug.
 */
import { eq, lte, or, sql } from "@tucatalogo/db";

import type { Database, Store } from "@tucatalogo/db";
import {
  auditLogs,
  categories,
  heroSlides,
  productImages,
  products,
  slugReservations,
  storeAccounts,
  storeSessions,
  storeUsers,
  storeVerifications,
  stores,
  type ActorType,
  type ColorMode,
  type Currency,
} from "@tucatalogo/db/schema";

export async function getStoreById(db: Database, storeId: string): Promise<Store | null> {
  const rows = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  return rows[0] ?? null;
}

export async function getStoreBySlug(db: Database, slug: string): Promise<Store | null> {
  const rows = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export interface StoreSettingsUpdate {
  name?: string;
  themeId?: string;
  primaryColor?: string;
  colorModeDefault?: ColorMode;
  currency?: Currency;
  whatsappNumber?: string | null;
  whatsappMessageTemplate?: string | null;
}

export async function updateStoreSettings(
  db: Database,
  storeId: string,
  values: StoreSettingsUpdate,
  now: Date,
): Promise<Store | null> {
  const rows = await db
    .update(stores)
    .set({ ...values, updatedAt: now })
    .where(eq(stores.id, storeId))
    .returning();
  return rows[0] ?? null;
}

export async function updateStoreLogoKey(
  db: Database,
  storeId: string,
  logoKey: string,
  now: Date,
): Promise<Store | null> {
  const rows = await db
    .update(stores)
    .set({ logoKey, updatedAt: now })
    .where(eq(stores.id, storeId))
    .returning();
  return rows[0] ?? null;
}

export interface StoreSuspension {
  status: "pending" | "active" | "suspended";
  suspendedBy: "owner" | "admin" | null;
  suspendedReason: string | null;
  suspendedAt: Date | null;
}

export async function updateStoreSuspension(
  db: Database,
  storeId: string,
  suspension: StoreSuspension,
  now: Date,
): Promise<Store | null> {
  const rows = await db
    .update(stores)
    .set({ ...suspension, updatedAt: now })
    .where(eq(stores.id, storeId))
    .returning();
  return rows[0] ?? null;
}

export interface DeleteStoreInput {
  storeId: string;
  slug: string;
  ownerId: string;
  ownerEmail: string;
  /** Instante del borrado: referencia para purgar verificaciones expiradas. */
  now: Date;
  /** Cuarentena nueva del slug (PLAN §6.10). */
  reservation: { id: string; reservedUntil: Date; createdAt: Date };
  audit: {
    id: string;
    actorType: ActorType;
    actorId: string | null;
    action: string;
    metadata: string | null;
    createdAt: Date;
  };
}

/** `%texto%` literal y en minúsculas: escapa los comodines de `LIKE`. */
function likeContains(value: string): string {
  const escaped = value.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

/**
 * Borrado definitivo en **un único batch** (transacción de D1), en el orden de
 * PLAN §6.13: hijos → `store` → `store_users` → cuarentena del slug → audit.
 *
 * El R2 se borra antes, en el service; aquí solo se ejecuta D1.
 */
export async function deleteStoreRows(db: Database, input: DeleteStoreInput): Promise<void> {
  await db.batch([
    db.delete(productImages).where(
      sql`${productImages.productId} in (select ${products.id} from ${products} where ${products.storeId} = ${input.storeId})`,
    ),
    db.delete(products).where(eq(products.storeId, input.storeId)),
    db.delete(categories).where(eq(categories.storeId, input.storeId)),
    db.delete(heroSlides).where(eq(heroSlides.storeId, input.storeId)),
    db.delete(storeSessions).where(eq(storeSessions.userId, input.ownerId)),
    db.delete(storeAccounts).where(eq(storeAccounts.userId, input.ownerId)),
    /**
     * Verificaciones del dueño: Better Auth guarda el reset con
     * `identifier = reset-password:<token>` y `value = userId`, así que se
     * borra por `value` (preciso), por identificador que contenga su email
     * (verificación de correo) y, de paso, las ya expiradas. Todo con
     * parámetros: sin interpolar SQL.
     */
    db.delete(storeVerifications).where(
      or(
        eq(storeVerifications.value, input.ownerId),
        sql`lower(${storeVerifications.identifier}) like ${likeContains(input.ownerEmail)} escape '\\'`,
        lte(storeVerifications.expiresAt, input.now),
      ),
    ),
    db.delete(stores).where(eq(stores.id, input.storeId)),
    db.delete(storeUsers).where(eq(storeUsers.id, input.ownerId)),
    // La cuarentena sustituye a cualquier reserva previa del mismo slug para
    // que la constraint única no aborte el borrado completo.
    db.delete(slugReservations).where(eq(slugReservations.slug, input.slug)),
    db.insert(slugReservations).values({
      id: input.reservation.id,
      slug: input.slug,
      storeId: input.storeId,
      reason: "deleted",
      reservedUntil: input.reservation.reservedUntil,
      createdAt: input.reservation.createdAt,
    }),
    db.insert(auditLogs).values({
      id: input.audit.id,
      actorType: input.audit.actorType,
      actorId: input.audit.actorId,
      storeId: input.storeId,
      storeSlug: input.slug,
      action: input.audit.action,
      targetType: "store",
      targetId: input.storeId,
      metadata: input.audit.metadata,
      ipHash: null,
      createdAt: input.audit.createdAt,
    }),
  ]);
}

/** Tienda + dueño para el panel (email del propietario en la ficha). */
export async function getStoreWithOwner(
  db: Database,
  storeId: string,
): Promise<{ store: Store; owner: { id: string; email: string; name: string } } | null> {
  const rows = await db
    .select()
    .from(stores)
    .innerJoin(storeUsers, eq(storeUsers.id, stores.ownerId))
    .where(eq(stores.id, storeId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    store: row.store,
    owner: { id: row.store_users.id, email: row.store_users.email, name: row.store_users.name },
  };
}

/** Cuenta de la tienda por email, para la limpieza de verificaciones. */
export async function getStoreOwnerEmail(db: Database, ownerId: string): Promise<string | null> {
  const rows = await db
    .select({ email: storeUsers.email })
    .from(storeUsers)
    .where(eq(storeUsers.id, ownerId))
    .limit(1);
  return rows[0]?.email ?? null;
}
