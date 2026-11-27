/**
 * Servicio de la tienda (PLAN §4.5 G/H, §6.5, §8.2).
 *
 * Reglas que viven aquí y no en el route:
 * - el estado (`status` + `suspendedBy`) manda en la suspensión/reactivación;
 * - eliminar es R2 primero y luego D1 en un batch (si R2 falla, no se toca D1);
 * - leer una tienda con tema/moneda/color corruptos es 500 + log, nunca un
 *   valor por defecto (PLAN §12).
 */
import type { Database, Store } from "@tucatalogo/db";
import { COLOR_MODES, CURRENCIES, type ColorMode, type Currency } from "@tucatalogo/types";
import type {
  PanelDeleteStoreInput,
  PanelStore,
  PanelStoreLogoResponse,
  PanelStoreUpdateInput,
  PublicStore,
} from "@tucatalogo/types";
import { getSlugRejectionReason, normalizeSlugInput } from "@tucatalogo/shared";
import { isThemeImplemented } from "@tucatalogo/themes";

import { getStoreAuth } from "../auth";
import { AuthEndpointError, callAuthEndpoint, toAuthHeaders } from "../auth/shared";
import {
  AUDIT_ACTIONS,
  CATALOG_MESSAGES,
  CATALOG_REASONS,
  SLUG_QUARANTINE_DAYS,
} from "../constants/catalog";
import type { Env } from "../env";
import { AppError } from "../errors";
import type { ImageUpload } from "../libs/media";
import { storeLogoObject } from "../libs/media";
import {
  deleteStoreRows,
  getStoreById,
  getStoreBySlug,
  getStoreOwnerEmail,
  getStoreWithOwner,
  updateStoreLogoKey,
  updateStoreSettings,
  updateStoreSuspension,
} from "../repositories/store";
import { recordAudit } from "./audit";
import { assertCatalogRateLimit } from "./catalog-rate-limit";
import { removeMediaObjects, removeStoreMedia, storeMediaObject, toMediaUrl } from "./media";

export interface StoreOwner {
  id: string;
  email: string;
  name: string;
}

export interface StoreContext {
  store: Store;
  owner: StoreOwner;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Comprueba que lo leído de D1 es representable. Corrupción = 500 + log
 * (PLAN §12); jamás se aplica un tema, color o moneda por defecto.
 */
export function assertStoreReadable(store: Store): void {
  if (!isThemeImplemented(store.themeId)) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Tema desconocido en D1",
        storeId: store.id,
        themeId: store.themeId,
      }),
    );
    throw new AppError("INTERNAL", "La configuración de la tienda no es válida.");
  }
  if (!(CURRENCIES as readonly string[]).includes(store.currency)) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Moneda desconocida en D1",
        storeId: store.id,
        currency: store.currency,
      }),
    );
    throw new AppError("INTERNAL", "La configuración de la tienda no es válida.");
  }
  if (!(COLOR_MODES as readonly string[]).includes(store.colorModeDefault)) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Modo de color desconocido en D1",
        storeId: store.id,
        colorModeDefault: store.colorModeDefault,
      }),
    );
    throw new AppError("INTERNAL", "La configuración de la tienda no es válida.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(store.primaryColor)) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Color principal inválido en D1",
        storeId: store.id,
      }),
    );
    throw new AppError("INTERNAL", "La configuración de la tienda no es válida.");
  }
}

/** Datos públicos de una tienda `active`. */
export function toPublicStore(env: Env, store: Store): PublicStore {
  assertStoreReadable(store);
  return {
    slug: store.slug,
    name: store.name,
    themeId: store.themeId,
    primaryColor: store.primaryColor,
    colorModeDefault: store.colorModeDefault as ColorMode,
    currency: store.currency as Currency,
    whatsappNumber: store.whatsappNumber,
    whatsappMessageTemplate: store.whatsappMessageTemplate,
    logoUrl: toMediaUrl(env, store.logoKey),
    updatedAt: store.updatedAt.toISOString(),
  };
}

/**
 * Resuelve la tienda pública por slug. Formato inválido, inexistente,
 * suspendida o eliminada devuelven el **mismo** 404 sin revelar el motivo.
 */
export async function getActiveStore(db: Database, rawSlug: string): Promise<Store> {
  const slug = normalizeSlugInput(rawSlug);
  if (getSlugRejectionReason(slug) !== null) {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeUnavailable);
  }

  const store = await getStoreBySlug(db, slug);
  if (!store || store.status !== "active") {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeUnavailable);
  }
  return store;
}

export async function getPublicStore(
  env: Env,
  db: Database,
  rawSlug: string,
): Promise<{ store: Store; data: PublicStore }> {
  const store = await getActiveStore(db, rawSlug);
  return { store, data: toPublicStore(env, store) };
}

export function toPanelStore(env: Env, store: Store, owner: StoreOwner): PanelStore {
  assertStoreReadable(store);
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    status: store.status,
    suspendedBy: store.suspendedBy,
    suspendedReason: store.suspendedReason,
    suspendedAt: iso(store.suspendedAt),
    themeId: store.themeId,
    primaryColor: store.primaryColor,
    colorModeDefault: store.colorModeDefault as ColorMode,
    currency: store.currency as Currency,
    whatsappNumber: store.whatsappNumber,
    whatsappMessageTemplate: store.whatsappMessageTemplate,
    logoKey: store.logoKey,
    logoUrl: toMediaUrl(env, store.logoKey),
    plan: store.plan,
    owner: { id: owner.id, email: owner.email, name: owner.name },
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

export async function getPanelStore(env: Env, db: Database, storeId: string): Promise<PanelStore> {
  const context = await getStoreWithOwner(db, storeId);
  if (!context) {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);
  }
  return toPanelStore(env, context.store, context.owner);
}

/** `PATCH /panel/store`: tema y color validados al escribir (400 si no existen). */
export async function updatePanelStore(
  env: Env,
  db: Database,
  context: StoreContext,
  input: PanelStoreUpdateInput,
): Promise<PanelStore> {
  if (input.themeId !== undefined && !isThemeImplemented(input.themeId)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Ese tema no está disponible.",
      [{ path: "themeId", message: "Tema desconocido" }],
      "THEME_UNAVAILABLE",
    );
  }

  const updated = await updateStoreSettings(
    db,
    context.store.id,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.themeId !== undefined ? { themeId: input.themeId } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.colorModeDefault !== undefined
        ? { colorModeDefault: input.colorModeDefault as ColorMode }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency as Currency } : {}),
      ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
      ...(input.whatsappMessageTemplate !== undefined
        ? { whatsappMessageTemplate: input.whatsappMessageTemplate }
        : {}),
    },
    new Date(),
  );

  if (!updated) {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);
  }
  return toPanelStore(env, updated, context.owner);
}

/** `POST /panel/store/logo`: sube a R2 y actualiza `logo_key`. */
export async function uploadStoreLogo(
  env: Env,
  db: Database,
  context: StoreContext,
  upload: ImageUpload,
): Promise<PanelStoreLogoResponse> {
  const key = storeLogoObject(context.store.id);
  await storeMediaObject(env, key, upload.bytes);

  const updated = await updateStoreLogoKey(db, context.store.id, key, new Date());
  if (!updated) {
    await removeMediaObjects(env, [key]);
    throw new AppError("INTERNAL", "No pudimos guardar el logo.");
  }

  if (context.store.logoKey && context.store.logoKey !== key) {
    await removeMediaObjects(env, [context.store.logoKey]);
  }

  const url = toMediaUrl(env, key);
  if (!url) throw new AppError("INTERNAL", "No pudimos construir la URL del logo.");
  return { logoKey: key, logoUrl: url };
}

/** Delete the store logo from R2 strictly before clearing `logo_key` in D1. */
export async function deleteStoreLogo(
  env: Env,
  db: Database,
  context: StoreContext,
): Promise<PanelStore> {
  if (context.store.logoKey) {
    await removeMediaObjects(env, [context.store.logoKey]);
  }
  const updated = await updateStoreLogoKey(db, context.store.id, null, new Date());
  if (!updated) {
    throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);
  }
  return toPanelStore(env, updated, context.owner);
}

/** `POST /panel/store/suspend`: solo el dueño; nunca pisa una suspensión admin. */
export async function suspendStoreByOwner(
  env: Env,
  db: Database,
  context: StoreContext,
  reason: string | undefined,
): Promise<PanelStore> {
  if (context.store.suspendedBy === "admin") {
    throw new AppError(
      "FORBIDDEN",
      CATALOG_MESSAGES.suspendedByAdmin,
      undefined,
      CATALOG_REASONS.suspendedByAdmin,
    );
  }

  const now = new Date();
  const updated = await updateStoreSuspension(
    db,
    context.store.id,
    {
      status: "suspended",
      suspendedBy: "owner",
      suspendedReason: reason ?? null,
      suspendedAt: context.store.suspendedAt ?? now,
    },
    now,
  );
  if (!updated) throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);

  await recordAudit(db, {
    actorType: "owner",
    actorId: context.owner.id,
    storeId: context.store.id,
    storeSlug: context.store.slug,
    action: AUDIT_ACTIONS.storeSuspend,
    targetType: "store",
    targetId: context.store.id,
    metadata: { reason: reason ?? null, source: "panel" },
  });

  return toPanelStore(env, updated, context.owner);
}

/** `POST /panel/store/reactivate`: solo si la suspensión fue del dueño. */
export async function reactivateStoreByOwner(
  env: Env,
  db: Database,
  context: StoreContext,
): Promise<PanelStore> {
  if (context.store.status === "active") {
    await recordAudit(db, {
      actorType: "owner",
      actorId: context.owner.id,
      storeId: context.store.id,
      storeSlug: context.store.slug,
      action: AUDIT_ACTIONS.storeReactivate,
      targetType: "store",
      targetId: context.store.id,
      metadata: { source: "panel", alreadyActive: true },
    });
    return toPanelStore(env, context.store, context.owner);
  }
  if (context.store.suspendedBy === "admin") {
    throw new AppError(
      "FORBIDDEN",
      CATALOG_MESSAGES.suspendedByAdmin,
      undefined,
      CATALOG_REASONS.suspendedByAdmin,
    );
  }

  const now = new Date();
  const updated = await updateStoreSuspension(
    db,
    context.store.id,
    { status: "active", suspendedBy: null, suspendedReason: null, suspendedAt: null },
    now,
  );
  if (!updated) throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);

  await recordAudit(db, {
    actorType: "owner",
    actorId: context.owner.id,
    storeId: context.store.id,
    storeSlug: context.store.slug,
    action: AUDIT_ACTIONS.storeReactivate,
    targetType: "store",
    targetId: context.store.id,
    metadata: { source: "panel", previousSuspendedBy: context.store.suspendedBy },
  });

  return toPanelStore(env, updated, context.owner);
}

export interface DeleteActor {
  type: "owner" | "admin";
  id: string;
  /** Motivo/resultado acotado para `audit_log` (sin PII). */
  metadata?: Record<string, unknown>;
}

/**
 * Hard delete (PLAN §4.5 H / §6.13): R2 por prefijo y, solo si eso va bien,
 * D1 en un batch (hijos → store → store_users → cuarentena → audit).
 * Un fallo de R2 aborta con 502 sin tocar D1.
 */
export async function hardDeleteStore(
  env: Env,
  db: Database,
  store: Store,
  actor: DeleteActor,
): Promise<void> {
  const removedObjects = await removeStoreMedia(env, store.id);

  const ownerEmail = await getStoreOwnerEmail(db, store.ownerId);
  if (!ownerEmail) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Tienda sin cuenta de dueño en D1",
        storeId: store.id,
      }),
    );
    throw new AppError("INTERNAL", "No pudimos eliminar la tienda.");
  }

  const now = new Date();
  await deleteStoreRows(db, {
    storeId: store.id,
    slug: store.slug,
    ownerId: store.ownerId,
    ownerEmail,
    now,
    reservation: {
      id: crypto.randomUUID(),
      reservedUntil: new Date(now.getTime() + SLUG_QUARANTINE_DAYS * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    audit: {
      id: crypto.randomUUID(),
      actorType: actor.type,
      actorId: actor.id,
      action: AUDIT_ACTIONS.storeDelete,
      metadata: JSON.stringify({ objects: removedObjects, ...actor.metadata }),
      createdAt: now,
    },
  });
}

/**
 * `DELETE /panel/store`: reautentica con Better Auth (sin crear sesión) antes
 * de borrar. Verifica también el slug escrito por el dueño.
 */
export async function deleteStoreByOwner(
  env: Env,
  db: Database,
  context: StoreContext,
  input: PanelDeleteStoreInput,
  request: Request,
  clientIp: string,
): Promise<void> {
  // Anti-abuso antes de tocar scrypt o R2 (B4). Sujeto = id de tienda.
  await assertCatalogRateLimit(db, "storeDeleteByOwner", context.store.id);

  if (input.confirmSlug.trim().toLowerCase() !== context.store.slug) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.confirmSlugMismatch,
      [{ path: "confirmSlug", message: CATALOG_MESSAGES.confirmSlugMismatch }],
      CATALOG_REASONS.confirmSlugMismatch,
    );
  }

  const auth = getStoreAuth(env);
  let verified: { status?: boolean };
  try {
    const result = await callAuthEndpoint<{ status?: boolean }>(
      auth.api.verifyPassword({
        body: { password: input.password },
        headers: toAuthHeaders(request, clientIp),
        asResponse: true,
      }),
    );
    verified = result.data ?? {};
  } catch (error) {
    if (error instanceof AuthEndpointError) {
      throw new AppError(
        "UNAUTHORIZED",
        CATALOG_MESSAGES.invalidPassword,
        undefined,
        CATALOG_REASONS.invalidPassword,
      );
    }
    throw error;
  }

  if (verified.status !== true) {
    throw new AppError(
      "UNAUTHORIZED",
      CATALOG_MESSAGES.invalidPassword,
      undefined,
      CATALOG_REASONS.invalidPassword,
    );
  }

  await hardDeleteStore(env, db, context.store, {
    type: "owner",
    id: context.owner.id,
    metadata: { source: "panel" },
  });
}

/** Contexto de panel desde el `storeId` ya resuelto por la sesión. */
export async function loadStoreContext(db: Database, storeId: string): Promise<StoreContext> {
  const context = await getStoreWithOwner(db, storeId);
  if (!context) throw new AppError("NOT_FOUND", CATALOG_MESSAGES.storeNotFound);
  return context;
}

/** Tienda completa por id (el console la necesita sin dueño embebido). */
export async function findStoreRow(db: Database, storeId: string): Promise<Store | null> {
  return getStoreById(db, storeId);
}
