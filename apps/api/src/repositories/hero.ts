/**
 * Repositorio del hero (PLAN §6.9). `image_desktop_key` / `image_mobile_key`
 * son **keys** de R2 (recortes distintos, no la misma imagen escalada).
 */
import { and, asc, eq, sql } from "@tucatalogo/db";

import type { Database, HeroSlide } from "@tucatalogo/db";
import { heroSlides } from "@tucatalogo/db/schema";

export async function listHeroSlides(
  db: Database,
  storeId: string,
  options: { onlyActive?: boolean } = {},
): Promise<HeroSlide[]> {
  const conditions = [eq(heroSlides.storeId, storeId)];
  if (options.onlyActive) conditions.push(eq(heroSlides.isActive, true));

  return db
    .select()
    .from(heroSlides)
    .where(and(...conditions))
    .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.createdAt));
}

export async function countHeroSlides(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(heroSlides)
    .where(eq(heroSlides.storeId, storeId));
  return Number(rows[0]?.total ?? 0);
}

export async function getHeroSlide(
  db: Database,
  storeId: string,
  slideId: string,
): Promise<HeroSlide | null> {
  const rows = await db
    .select()
    .from(heroSlides)
    .where(and(eq(heroSlides.storeId, storeId), eq(heroSlides.id, slideId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function maxHeroSortOrder(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${heroSlides.sortOrder}), 0)` })
    .from(heroSlides)
    .where(eq(heroSlides.storeId, storeId));
  return Number(rows[0]?.value ?? 0);
}

export interface NewHeroSlideInput {
  id: string;
  storeId: string;
  imageDesktopKey: string;
  imageMobileKey: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  now: Date;
}

export async function insertHeroSlide(
  db: Database,
  input: NewHeroSlideInput,
): Promise<HeroSlide> {
  const rows = await db
    .insert(heroSlides)
    .values({
      id: input.id,
      storeId: input.storeId,
      imageDesktopKey: input.imageDesktopKey,
      imageMobileKey: input.imageMobileKey,
      title: input.title,
      subtitle: input.subtitle,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning();
  return rows[0]!;
}

export interface HeroSlideUpdate {
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  imageDesktopKey?: string;
  imageMobileKey?: string;
}

export async function updateHeroSlide(
  db: Database,
  storeId: string,
  slideId: string,
  values: HeroSlideUpdate,
  now: Date,
): Promise<HeroSlide | null> {
  const rows = await db
    .update(heroSlides)
    .set({ ...values, updatedAt: now })
    .where(and(eq(heroSlides.storeId, storeId), eq(heroSlides.id, slideId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteHeroSlide(
  db: Database,
  storeId: string,
  slideId: string,
): Promise<boolean> {
  const rows = await db
    .delete(heroSlides)
    .where(and(eq(heroSlides.storeId, storeId), eq(heroSlides.id, slideId)))
    .returning({ id: heroSlides.id });
  return rows.length === 1;
}

export async function listHeroSlideIds(db: Database, storeId: string): Promise<string[]> {
  const rows = await db
    .select({ id: heroSlides.id })
    .from(heroSlides)
    .where(eq(heroSlides.storeId, storeId));
  return rows.map((row) => row.id);
}

export async function reorderHeroSlides(
  db: Database,
  storeId: string,
  ids: readonly string[],
  now: Date,
): Promise<void> {
  const statements = ids.map((id, index) =>
    db
      .update(heroSlides)
      .set({ sortOrder: index, updatedAt: now })
      .where(and(eq(heroSlides.storeId, storeId), eq(heroSlides.id, id))),
  );
  if (statements.length === 0) return;
  await db.batch([statements[0]!, ...statements.slice(1)]);
}
