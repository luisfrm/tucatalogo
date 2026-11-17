/**
 * Servicio del console (PLAN §7.8 / §11).
 *
 * Solo metadatos: el admin no lee productos ni imágenes editables. Suspender y
 * reactivar son siempre del console; eliminar reutiliza el hard delete del
 * servicio de tienda (R2 primero).
 */
import type { Database, Store } from "@tucatalogo/db";
import type {
  ConsoleStoreDetail,
  ConsoleStoreList,
  ConsoleStoresQuery,
} from "@tucatalogo/types";

import {
  AUDIT_ACTIONS,
  CATALOG_MESSAGES,
  CATALOG_REASONS,
  PAGE_SIZE,
} from "../constants/catalog";
import type { Env } from "../env";
import { AppError } from "../errors";
import { pageWindow } from "../libs/pagination";
import {
  getConsoleStore,
  listConsoleStores,
  type ConsoleStoreRow,
} from "../repositories/console";
import { getStoreById, updateStoreSuspension } from "../repositories/store";
import { hardDeleteStore } from "./store";
import { recordAudit } from "./audit";

export interface ConsoleActor {
  id: string;
  email: string;
}

function toListItem(row: ConsoleStoreRow) {
  return {
    id: row.store.id,
    slug: row.store.slug,
    name: row.store.name,
    status: row.store.status,
    suspendedBy: row.store.suspendedBy,
    suspendedAt: row.store.suspendedAt ? row.store.suspendedAt.toISOString() : null,
    ownerEmail: row.ownerEmail,
    createdAt: row.store.createdAt.toISOString(),
    updatedAt: row.store.updatedAt.toISOString(),
  };
}

export async function listConsoleStorePage(
  db: Database,
  query: ConsoleStoresQuery,
): Promise<ConsoleStoreList> {
  const { rows, total } = await listConsoleStores(
    db,
    { q: query.q, status: query.status },
    pageWindow(query.page, PAGE_SIZE.console),
  );

  return {
    items: rows.map(toListItem),
    page: query.page,
    pageSize: PAGE_SIZE.console,
    total,
    hasMore: query.page * PAGE_SIZE.console < total,
  };
}

export async function getConsoleStoreDetail(
  db: Database,
  storeId: string,
): Promise<ConsoleStoreDetail> {
  const found = await getConsoleStore(db, storeId);
  if (!found) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.consoleStoreNotFound,
      undefined,
      CATALOG_REASONS.consoleStoreNotFound,
    );
  }

  const base = toListItem({ store: found.store, ownerEmail: found.owner.email });
  return {
    ...base,
    suspendedReason: found.store.suspendedReason,
    themeId: found.store.themeId,
    primaryColor: found.store.primaryColor,
    colorModeDefault: found.store.colorModeDefault,
    currency: found.store.currency,
    plan: found.store.plan,
    whatsappNumber: found.store.whatsappNumber,
    owner: found.owner,
    productCount: found.counts.productCount,
    categoryCount: found.counts.categoryCount,
    slideCount: found.counts.slideCount,
    imageCount: found.counts.imageCount,
  };
}

async function requireStore(db: Database, storeId: string): Promise<Store> {
  const store = await getStoreById(db, storeId);
  if (!store) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.consoleStoreNotFound,
      undefined,
      CATALOG_REASONS.consoleStoreNotFound,
    );
  }
  return store;
}

/** `POST /console/stores/:id/suspend`: motivo obligatorio + audit. */
export async function suspendStoreByAdmin(
  db: Database,
  storeId: string,
  reason: string,
  actor: ConsoleActor,
): Promise<ConsoleStoreDetail> {
  const store = await requireStore(db, storeId);
  const now = new Date();

  // Idempotente: una suspensión repetida actualiza el motivo y audita igual.
  await updateStoreSuspension(
    db,
    store.id,
    { status: "suspended", suspendedBy: "admin", suspendedReason: reason, suspendedAt: now },
    now,
  );

  await recordAudit(db, {
    actorType: "admin",
    actorId: actor.id,
    storeId: store.id,
    storeSlug: store.slug,
    action: AUDIT_ACTIONS.storeSuspend,
    targetType: "store",
    targetId: store.id,
    metadata: { reason },
  });

  return getConsoleStoreDetail(db, storeId);
}

/** `POST /console/stores/:id/reactivate`: el console reactiva siempre. */
export async function reactivateStoreByAdmin(
  db: Database,
  storeId: string,
  actor: ConsoleActor,
): Promise<ConsoleStoreDetail> {
  const store = await requireStore(db, storeId);
  const now = new Date();

  await updateStoreSuspension(
    db,
    store.id,
    { status: "active", suspendedBy: null, suspendedReason: null, suspendedAt: null },
    now,
  );

  await recordAudit(db, {
    actorType: "admin",
    actorId: actor.id,
    storeId: store.id,
    storeSlug: store.slug,
    action: AUDIT_ACTIONS.storeReactivate,
    targetType: "store",
    targetId: store.id,
    metadata: { previousSuspendedBy: store.suspendedBy },
  });

  return getConsoleStoreDetail(db, storeId);
}

/**
 * `DELETE /console/stores/:id`: exige escribir el slug y ejecuta el hard
 * delete (R2 → D1 batch → cuarentena → audit).
 */
export async function deleteStoreByAdmin(
  env: Env,
  db: Database,
  storeId: string,
  confirmSlug: string,
  actor: ConsoleActor,
): Promise<void> {
  const store = await requireStore(db, storeId);

  if (confirmSlug.trim().toLowerCase() !== store.slug) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.confirmSlugMismatch,
      [{ path: "confirmSlug", message: CATALOG_MESSAGES.confirmSlugMismatch }],
      CATALOG_REASONS.confirmSlugMismatch,
    );
  }

  await hardDeleteStore(env, db, store, {
    type: "admin",
    id: actor.id,
    metadata: { source: "console" },
  });
}
