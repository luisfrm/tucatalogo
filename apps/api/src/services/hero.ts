/**
 * Servicio del hero (PLAN §6.9 / §8.2).
 *
 * `POST /panel/hero` crea el slide **con** sus dos imágenes ya normalizadas en
 * el navegador: la tabla exige ambas keys y no se admiten placeholders.
 */
import type { Database, HeroSlide, Store } from "@tucatalogo/db";
import type {
  HeroUpdateInput,
  PanelHeroList,
  PanelHeroSlide,
  PublicHero,
  PublicHeroSlide,
} from "@tucatalogo/types";

import {
  CATALOG_MESSAGES,
  CATALOG_REASONS,
  MEDIA_LIMITS,
} from "../constants/catalog";
import type { Env } from "../env";
import { AppError } from "../errors";
import type { ImageUpload } from "../libs/media";
import { heroImageObjects } from "../libs/media";
import {
  countHeroSlides,
  deleteHeroSlide,
  getHeroSlide,
  insertHeroSlide,
  listHeroSlideIds,
  listHeroSlides,
  maxHeroSortOrder,
  reorderHeroSlides,
  updateHeroSlide,
} from "../repositories/hero";
import { removeMediaObject, removeMediaObjects, storeMediaObject, toMediaUrl } from "./media";
import { assertStoreReadable } from "./store";

function requireUrl(env: Env, key: string): string {
  const url = toMediaUrl(env, key);
  if (!url) throw new AppError("INTERNAL", "No pudimos construir la URL del slide.");
  return url;
}

export function toPanelHeroSlide(env: Env, slide: HeroSlide): PanelHeroSlide {
  return {
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    ctaLabel: slide.ctaLabel,
    ctaUrl: slide.ctaUrl,
    isActive: slide.isActive,
    sortOrder: slide.sortOrder,
    desktopUrl: requireUrl(env, slide.imageDesktopKey),
    mobileUrl: requireUrl(env, slide.imageMobileKey),
    createdAt: slide.createdAt.toISOString(),
    updatedAt: slide.updatedAt.toISOString(),
  };
}

export function toPublicHeroSlide(env: Env, slide: HeroSlide): PublicHeroSlide {
  return {
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    ctaLabel: slide.ctaLabel,
    ctaUrl: slide.ctaUrl,
    sortOrder: slide.sortOrder,
    desktopUrl: requireUrl(env, slide.imageDesktopKey),
    mobileUrl: requireUrl(env, slide.imageMobileKey),
  };
}

export async function listPanelHero(
  env: Env,
  db: Database,
  store: Store,
): Promise<PanelHeroList> {
  const slides = await listHeroSlides(db, store.id);
  return { items: slides.map((slide) => toPanelHeroSlide(env, slide)), limit: MEDIA_LIMITS.heroSlides };
}

/** Storefront: solo slides activos, ordenados. */
export async function listPublicHero(
  env: Env,
  db: Database,
  store: Store,
): Promise<PublicHero> {
  assertStoreReadable(store);
  const slides = await listHeroSlides(db, store.id, { onlyActive: true });
  return { items: slides.map((slide) => toPublicHeroSlide(env, slide)) };
}

function normalizeText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** El CTA se renderiza solo con etiqueta y URL; uno sin el otro es 400. */
function assertCta(label: string | null, url: string | null): void {
  if ((label === null) !== (url === null)) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.heroCtaIncomplete,
      [{ path: "ctaUrl", message: CATALOG_MESSAGES.heroCtaIncomplete }],
      CATALOG_REASONS.heroCtaIncomplete,
    );
  }
}

async function loadSlide(db: Database, storeId: string, slideId: string): Promise<HeroSlide> {
  const slide = await getHeroSlide(db, storeId, slideId);
  if (!slide) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.heroNotFound,
      undefined,
      CATALOG_REASONS.heroNotFound,
    );
  }
  return slide;
}

export interface HeroCreateInput {
  desktop: ImageUpload;
  mobile: ImageUpload;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  isActive: boolean;
  sortOrder?: number;
}

/** `POST /panel/hero`: multipart con `desktop` + `mobile` y el texto del slide. */
export async function createHeroSlide(
  env: Env,
  db: Database,
  store: Store,
  input: HeroCreateInput,
): Promise<PanelHeroSlide> {
  const total = await countHeroSlides(db, store.id);
  if (total >= MEDIA_LIMITS.heroSlides) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.heroLimit,
      [{ path: "slides", message: CATALOG_MESSAGES.heroLimit }],
      CATALOG_REASONS.heroLimit,
    );
  }

  const label = normalizeText(input.ctaLabel) ?? null;
  const url = normalizeText(input.ctaUrl) ?? null;
  assertCta(label, url);

  const slideId = crypto.randomUUID();
  const objects = heroImageObjects(store.id, slideId);

  await storeMediaObject(env, objects.desktop, input.desktop.bytes);
  try {
    await storeMediaObject(env, objects.mobile, input.mobile.bytes);
  } catch (error) {
    await removeMediaObjects(env, [objects.desktop]);
    throw error;
  }

  const sortOrder = input.sortOrder ?? (await maxHeroSortOrder(db, store.id)) + 1;

  let slide: HeroSlide;
  try {
    slide = await insertHeroSlide(db, {
      id: slideId,
      storeId: store.id,
      imageDesktopKey: objects.desktop,
      imageMobileKey: objects.mobile,
      title: normalizeText(input.title) ?? null,
      subtitle: normalizeText(input.subtitle) ?? null,
      ctaLabel: label,
      ctaUrl: url,
      sortOrder,
      isActive: input.isActive,
      now: new Date(),
    });
  } catch (error) {
    await removeMediaObjects(env, [objects.desktop, objects.mobile]);
    throw error;
  }

  return toPanelHeroSlide(env, slide);
}

export async function updatePanelHero(
  env: Env,
  db: Database,
  store: Store,
  slideId: string,
  input: HeroUpdateInput,
): Promise<PanelHeroSlide> {
  const slide = await loadSlide(db, store.id, slideId);

  const nextLabel =
    input.ctaLabel !== undefined ? (normalizeText(input.ctaLabel) ?? null) : slide.ctaLabel;
  const nextUrl =
    input.ctaUrl !== undefined ? (normalizeText(input.ctaUrl) ?? null) : slide.ctaUrl;
  assertCta(nextLabel, nextUrl);

  const updated = await updateHeroSlide(
    db,
    store.id,
    slideId,
    {
      ...(input.title !== undefined ? { title: normalizeText(input.title) ?? null } : {}),
      ...(input.subtitle !== undefined ? { subtitle: normalizeText(input.subtitle) ?? null } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: nextLabel } : {}),
      ...(input.ctaUrl !== undefined ? { ctaUrl: nextUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    new Date(),
  );

  if (!updated) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.heroNotFound,
      undefined,
      CATALOG_REASONS.heroNotFound,
    );
  }
  return toPanelHeroSlide(env, updated);
}

/** Borra los dos objetos y después la fila. Si R2 falla, no se toca D1. */
export async function deletePanelHero(
  env: Env,
  db: Database,
  store: Store,
  slideId: string,
): Promise<void> {
  const slide = await loadSlide(db, store.id, slideId);
  await removeMediaObject(env, slide.imageDesktopKey);
  await removeMediaObject(env, slide.imageMobileKey);

  const deleted = await deleteHeroSlide(db, store.id, slideId);
  if (!deleted) {
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.heroNotFound,
      undefined,
      CATALOG_REASONS.heroNotFound,
    );
  }
}

export async function reorderPanelHero(
  env: Env,
  db: Database,
  store: Store,
  ids: readonly string[],
): Promise<PanelHeroList> {
  const existing = await listHeroSlideIds(db, store.id);
  const requested = new Set(ids);
  if (existing.length !== requested.size || existing.some((id) => !requested.has(id))) {
    throw new AppError(
      "VALIDATION_ERROR",
      CATALOG_MESSAGES.reorderMismatch,
      [{ path: "ids", message: CATALOG_MESSAGES.reorderMismatch }],
      CATALOG_REASONS.reorderMismatch,
    );
  }

  await reorderHeroSlides(db, store.id, ids, new Date());
  return listPanelHero(env, db, store);
}

export interface HeroImagesUpload {
  desktop: ImageUpload;
  mobile: ImageUpload;
}

/** `POST /panel/hero/:id/images`: reemplaza las dos variantes del slide. */
export async function replaceHeroImages(
  env: Env,
  db: Database,
  store: Store,
  slideId: string,
  upload: HeroImagesUpload,
): Promise<PanelHeroSlide> {
  const slide = await loadSlide(db, store.id, slideId);
  const objects = heroImageObjects(store.id, slideId);

  await storeMediaObject(env, objects.desktop, upload.desktop.bytes);
  try {
    await storeMediaObject(env, objects.mobile, upload.mobile.bytes);
  } catch (error) {
    await removeMediaObjects(env, [objects.desktop]);
    throw error;
  }

  const updated = await updateHeroSlide(
    db,
    store.id,
    slideId,
    { imageDesktopKey: objects.desktop, imageMobileKey: objects.mobile },
    new Date(),
  );

  if (!updated) {
    await removeMediaObjects(env, [objects.desktop, objects.mobile]);
    throw new AppError(
      "NOT_FOUND",
      CATALOG_MESSAGES.heroNotFound,
      undefined,
      CATALOG_REASONS.heroNotFound,
    );
  }

  // Las keys son inmutables: los objetos anteriores ya no los referencia nadie.
  await removeMediaObjects(env, [slide.imageDesktopKey, slide.imageMobileKey]);

  return toPanelHeroSlide(env, updated);
}
