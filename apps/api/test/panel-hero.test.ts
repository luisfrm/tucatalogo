import { beforeEach, describe, expect, it } from "vitest";

import { testEnv } from "./env";
import {
  createStore,
  panelMultipart,
  panelRequest,
  readJson,
  resetAdminRealm,
  type StoreFixture,
} from "./fixtures";
import { getJson } from "./helpers";
import { heroForm } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

interface SlideBody {
  id: string;
  title: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  desktopUrl: string;
  mobileUrl: string;
}

async function createSlide(
  fixture: StoreFixture,
  fields: Record<string, string> = {},
): Promise<SlideBody> {
  const response = await panelMultipart(fixture, "/panel/hero", heroForm(fields));
  if (response.status !== 201) throw new Error(await response.text());
  return readJson<SlideBody>(response);
}

function r2Key(url: string): string {
  return url.replace("http://127.0.0.1:9797/media/", "");
}

describe("hero del panel", () => {
  it("crea el slide con sus dos imágenes y lo publica si está activo", async () => {
    const fixture = await createStore();
    const slide = await createSlide(fixture, {
      title: "Nueva colección",
      subtitle: "Verano 2026",
      ctaLabel: "Ver zapatos",
      ctaUrl: "/productos",
    });

    expect(slide).toMatchObject({
      title: "Nueva colección",
      ctaLabel: "Ver zapatos",
      ctaUrl: "/productos",
      isActive: true,
      sortOrder: 1,
    });
    expect(slide.desktopUrl.startsWith(`http://127.0.0.1:9797/media/stores/${fixture.storeId}/hero/`)).toBe(true);
    expect(await testEnv.MEDIA_BUCKET.get(r2Key(slide.desktopUrl))).toBeTruthy();
    expect(await testEnv.MEDIA_BUCKET.get(r2Key(slide.mobileUrl))).toBeTruthy();

    const list = await panelRequest(fixture, "GET", "/panel/hero");
    expect(list.status).toBe(200);
    expect(await readJson(list)).toMatchObject({ limit: 10, items: [{ id: slide.id }] });

    const publicHero = await getJson(`/public/${fixture.slug}/hero`);
    expect(publicHero.status).toBe(200);
    expect(await readJson(publicHero)).toMatchObject({
      items: [{ id: slide.id, title: "Nueva colección", desktopUrl: slide.desktopUrl }],
    });
  });

  it("valida el CTA (https o ruta relativa, etiqueta y URL juntas)", async () => {
    const fixture = await createStore();

    const insecure = await panelMultipart(
      fixture,
      "/panel/hero",
      heroForm({ ctaLabel: "Ir", ctaUrl: "http://example.com" }),
    );
    expect(insecure.status).toBe(400);

    const protocolRelative = await panelMultipart(
      fixture,
      "/panel/hero",
      heroForm({ ctaLabel: "Ir", ctaUrl: "//example.com" }),
    );
    expect(protocolRelative.status).toBe(400);

    const missingUrl = await panelMultipart(
      fixture,
      "/panel/hero",
      heroForm({ ctaLabel: "Solo etiqueta" }),
    );
    expect(missingUrl.status).toBe(400);

    const slide = await createSlide(fixture);
    const incomplete = await panelRequest(fixture, "PATCH", `/panel/hero/${slide.id}`, {
      ctaLabel: "Ahora sí",
    });
    expect(incomplete.status).toBe(400);
    expect(await readJson(incomplete)).toMatchObject({
      error: { code: "VALIDATION_ERROR", reason: "HERO_CTA_INCOMPLETE" },
    });

    const cleared = await panelRequest(fixture, "PATCH", `/panel/hero/${slide.id}`, {
      ctaLabel: null,
      ctaUrl: null,
      title: null,
    });
    expect(cleared.status).toBe(200);
    expect(await readJson(cleared)).toMatchObject({ ctaLabel: null, ctaUrl: null, title: null });
  });

  it("oculta el slide inactivo del storefront y respeta el tope de 10", async () => {
    const fixture = await createStore();
    const slide = await createSlide(fixture);

    const hidden = await panelRequest(fixture, "PATCH", `/panel/hero/${slide.id}`, {
      isActive: false,
    });
    expect(hidden.status).toBe(200);
    expect(await readJson<{ items: unknown[] }>(await getJson(`/public/${fixture.slug}/hero`)))
      .toMatchObject({ items: [] });

    const now = Date.now();
    await testEnv.DB.batch(
      Array.from({ length: 10 }, (_, index) =>
        testEnv.DB.prepare(
          "INSERT INTO hero_slide (id, store_id, image_desktop_key, image_mobile_key, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        ).bind(
          crypto.randomUUID(),
          fixture.storeId,
          `stores/${fixture.storeId}/hero/extra-${index}-desktop.webp`,
          `stores/${fixture.storeId}/hero/extra-${index}-mobile.webp`,
          index + 2,
          now,
          now,
        ),
      ),
    );

    const limited = await panelMultipart(fixture, "/panel/hero", heroForm());
    expect(limited.status).toBe(400);
    expect(await readJson(limited)).toMatchObject({ error: { reason: "HERO_LIMIT_REACHED" } });
  });

  it("reemplaza las imágenes y borra los objetos anteriores", async () => {
    const fixture = await createStore();
    const slide = await createSlide(fixture);
    const oldDesktop = r2Key(slide.desktopUrl);

    const replaced = await panelMultipart(
      fixture,
      `/panel/hero/${slide.id}/images`,
      heroForm(),
    );
    expect(replaced.status).toBe(200);
    const updated = await readJson<SlideBody>(replaced);
    expect(updated.desktopUrl).not.toBe(slide.desktopUrl);

    expect(await testEnv.MEDIA_BUCKET.get(oldDesktop)).toBeFalsy();
    expect(await testEnv.MEDIA_BUCKET.get(r2Key(updated.desktopUrl))).toBeTruthy();
  });

  it("reordena con el conjunto exacto y borra fila + objetos", async () => {
    const fixture = await createStore();
    const first = await createSlide(fixture, { title: "Uno" });
    const second = await createSlide(fixture, { title: "Dos" });

    const mismatch = await panelRequest(fixture, "PATCH", "/panel/hero/reorder", {
      ids: [first.id],
    });
    expect(mismatch.status).toBe(400);

    const reordered = await panelRequest(fixture, "PATCH", "/panel/hero/reorder", {
      ids: [second.id, first.id],
    });
    expect(reordered.status).toBe(200);
    expect(await readJson<{ items: { id: string }[] }>(reordered)).toMatchObject({
      items: [{ id: second.id }, { id: first.id }],
    });

    const desktopKey = r2Key(first.desktopUrl);
    const mobileKey = r2Key(first.mobileUrl);
    const deleted = await panelRequest(fixture, "DELETE", `/panel/hero/${first.id}`);
    expect(deleted.status).toBe(204);

    expect(await testEnv.MEDIA_BUCKET.get(desktopKey)).toBeFalsy();
    expect(await testEnv.MEDIA_BUCKET.get(mobileKey)).toBeFalsy();

    const count = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM hero_slide WHERE store_id = ?",
    )
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(count?.total).toBe(1);
  });

  it("aísla tiendas: A no edita ni borra slides de B", async () => {
    const storeA = await createStore();
    const storeB = await createStore();
    const slideB = await createSlide(storeB);

    expect(
      (await panelRequest(storeA, "PATCH", `/panel/hero/${slideB.id}`, { title: "X" })).status,
    ).toBe(404);
    expect((await panelRequest(storeA, "DELETE", `/panel/hero/${slideB.id}`)).status).toBe(404);
    expect(await readJson<{ items: unknown[] }>(await panelRequest(storeA, "GET", "/panel/hero")))
      .toMatchObject({ items: [] });

    const publicA = await getJson(`/public/${storeA.slug}/hero`);
    expect(await readJson<{ items: unknown[] }>(publicA)).toMatchObject({ items: [] });
  });
});
