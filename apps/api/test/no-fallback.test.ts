import { beforeEach, describe, expect, it } from "vitest";

import { createDb } from "@tucatalogo/db";

import { AppError } from "../src/errors";
import { getPublicStore } from "../src/services/store";
import { testEnv } from "./env";
import { createStore, panelRequest, readJson, resetAdminRealm } from "./fixtures";
import { getJson } from "./helpers";

beforeEach(async () => {
  await resetAdminRealm();
});

function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  return fn().catch((error: unknown) => error);
}

describe("MEDIA_BASE_URL obligatoria", () => {
  it("sin MEDIA_BASE_URL la tienda pública responde 503 (no inventa host)", async () => {
    const fixture = await createStore();
    const db = createDb(testEnv.DB);
    const envWithoutMedia = { ...testEnv, MEDIA_BASE_URL: "" };

    const error = await captureError(() => getPublicStore(envWithoutMedia, db, fixture.slug));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      reason: "MEDIA_BASE_URL_MISSING",
    });
  });

  it("una MEDIA_BASE_URL con barra final se rechaza igual", async () => {
    const fixture = await createStore();
    const db = createDb(testEnv.DB);
    const envWithSlash = {
      ...testEnv,
      MEDIA_BASE_URL: "http://127.0.0.1:9797/media/",
    };

    const error = await captureError(() => getPublicStore(envWithSlash, db, fixture.slug));
    expect(error).toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
  });
});

describe("corrupción en D1 al leer", () => {
  it("tema desconocido → 500 + log en storefront y panel", async () => {
    const fixture = await createStore();
    await testEnv.DB.prepare("UPDATE store SET theme_id = 'no-existe' WHERE id = ?")
      .bind(fixture.storeId)
      .run();

    const publicResponse = await getJson(`/public/${fixture.slug}/store`);
    expect(publicResponse.status).toBe(500);
    const publicBody = await readJson<{ error: { code: string; message: string; requestId: string } }>(
      publicResponse,
    );
    expect(publicBody.error.code).toBe("INTERNAL");
    expect(publicBody.error.requestId).toBeTruthy();
    expect(JSON.stringify(publicBody)).not.toContain("no-existe");

    const panelResponse = await panelRequest(fixture, "GET", "/panel/store");
    expect(panelResponse.status).toBe(500);
  });

  it("moneda o modo corruptos → 500 (nunca se aplica un valor por defecto)", async () => {
    const fixture = await createStore();
    const { createDb } = await import("@tucatalogo/db");
    const { getStoreById } = await import("../src/repositories/store");
    const { assertStoreReadable } = await import("../src/services/store");

    const db = createDb(testEnv.DB);
    const store = (await getStoreById(db, fixture.storeId))!;

    // El `CHECK` de D1 impide corromper la moneda por SQL: la garantía es
    // doble. La lectura corrupta se prueba con la fila ya leída.
    expect(() => assertStoreReadable({ ...store, currency: "GBP" } as unknown as typeof store)).toThrow(
      AppError,
    );
    expect(() =>
      assertStoreReadable({ ...store, colorModeDefault: "neon" } as unknown as typeof store),
    ).toThrow(AppError);
    expect(() => assertStoreReadable({ ...store, primaryColor: "azul" })).toThrow(AppError);
    expect(() => assertStoreReadable({ ...store, themeId: "no-existe" })).toThrow(AppError);
    expect(() => assertStoreReadable(store)).not.toThrow();
  });

  it("color corrupto → 500", async () => {
    const fixture = await createStore();
    await testEnv.DB.prepare("UPDATE store SET primary_color = 'azul' WHERE id = ?")
      .bind(fixture.storeId)
      .run();

    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(500);
  });
});

describe("entrada inválida = 4xx, nunca 500", () => {
  it("query, params y bodies inválidos no producen 500", async () => {
    const fixture = await createStore();

    const badPage = await getJson(`/public/${fixture.slug}/products?page=0`);
    expect(badPage.status).toBe(400);
    expect(await readJson(badPage)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const longId = "x".repeat(80);
    expect((await panelRequest(fixture, "GET", `/panel/products/${longId}`)).status).toBe(400);

    const badPrice = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Malo",
      slug: "malo",
      priceMinor: "gratis",
    });
    expect(badPrice.status).toBe(400);

    const badColor = await panelRequest(fixture, "PATCH", "/panel/store", {
      primaryColor: "#12345",
    });
    expect(badColor.status).toBe(400);

    const missingBody = await panelRequest(fixture, "PATCH", "/panel/store");
    expect(missingBody.status).toBe(400);

    const unknownRoute = await getJson(`/public/${fixture.slug}/no-existe`);
    expect(unknownRoute.status).toBe(404);
  });
});
