import { beforeEach, describe, expect, it } from "vitest";

import { testEnv } from "./env";
import {
  STORE_PASSWORD,
  consoleRequest,
  createAdminSession,
  createStore,
  panelMultipart,
  panelRequest,
  readJson,
  resetAdminRealm,
} from "./fixtures";
import { api, getJson, hasCookie } from "./helpers";
import { logoForm, pngBytes, webpImage } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

describe("GET/PATCH /panel/store", () => {
  it("devuelve la ficha editable y aplica cambios validados", async () => {
    const fixture = await createStore({ whatsappNumber: "584121234567" });

    const response = await panelRequest(fixture, "GET", "/panel/store");
    expect(response.status).toBe(200);
    const body = await readJson<{
      slug: string;
      status: string;
      themeId: string;
      currency: string;
      whatsappNumber: string | null;
      owner: { email: string };
      logoUrl: string | null;
    }>(response);

    expect(body).toMatchObject({
      slug: fixture.slug,
      status: "active",
      themeId: "rose",
      currency: "USD",
      whatsappNumber: "584121234567",
      logoUrl: null,
    });
    expect(body.owner.email).toBe(fixture.email);

    const patch = await panelRequest(fixture, "PATCH", "/panel/store", {
      name: "Nueva Tienda",
      themeId: "velvet-noir",
      primaryColor: "#112233",
      currency: "COP",
      whatsappMessageTemplate: "Hola {tienda}, quiero {producto}",
    });
    expect(patch.status).toBe(200);
    expect(await readJson(patch)).toMatchObject({
      name: "Nueva Tienda",
      themeId: "velvet-noir",
      primaryColor: "#112233",
      currency: "COP",
      whatsappMessageTemplate: "Hola {tienda}, quiero {producto}",
    });

    // Quitar el número es explícito (`null`), no un valor por defecto.
    const cleared = await panelRequest(fixture, "PATCH", "/panel/store", {
      whatsappNumber: null,
    });
    expect(cleared.status).toBe(200);
    expect(await readJson(cleared)).toMatchObject({ whatsappNumber: null });
  });

  it("rechaza tema, color, moneda y payloads inválidos con 400", async () => {
    const fixture = await createStore();

    const unknownTheme = await panelRequest(fixture, "PATCH", "/panel/store", {
      themeId: "no-existe",
    });
    expect(unknownTheme.status).toBe(400);
    expect(await readJson(unknownTheme)).toMatchObject({
      error: { code: "VALIDATION_ERROR", reason: "THEME_UNAVAILABLE" },
    });

    expect(
      (await panelRequest(fixture, "PATCH", "/panel/store", { currency: "GBP" })).status,
    ).toBe(400);
    expect(
      (await panelRequest(fixture, "PATCH", "/panel/store", { primaryColor: "azul" })).status,
    ).toBe(400);
    expect(
      (await panelRequest(fixture, "PATCH", "/panel/store", { whatsappNumber: "+58 412" })).status,
    ).toBe(400);
    expect((await panelRequest(fixture, "PATCH", "/panel/store", {})).status).toBe(400);
  });

  it("aísla tiendas y reinos: la cookie de A no abre B ni el console abre el panel", async () => {
    const storeA = await createStore();
    const storeB = await createStore();

    const crossed = await api("/panel/store", {
      headers: { cookie: storeA.cookie, "x-store-slug": storeB.slug },
    });
    expect(crossed.status).toBe(403);
    expect(await readJson(crossed)).toMatchObject({
      error: { code: "FORBIDDEN", reason: "STORE_MISMATCH" },
    });

    const admin = await createAdminSession();
    const wrongRealm = await api("/panel/store", {
      headers: { cookie: admin.cookie, "x-store-slug": storeA.slug },
    });
    expect(wrongRealm.status).toBe(401);
  });
});

describe("POST /panel/store/logo", () => {
  it("sube el logo a R2 con cache inmutable y devuelve la URL", async () => {
    const fixture = await createStore();

    const response = await panelMultipart(fixture, "/panel/store/logo", logoForm());
    expect(response.status).toBe(201);
    const body = await readJson<{ logoKey: string; logoUrl: string }>(response);

    expect(body.logoKey.startsWith(`stores/${fixture.storeId}/logo/`)).toBe(true);
    expect(body.logoKey.endsWith(".webp")).toBe(true);
    expect(body.logoUrl).toBe(`http://127.0.0.1:9797/media/${body.logoKey}`);

    const object = await testEnv.MEDIA_BUCKET.get(body.logoKey);
    expect(object).toBeTruthy();
    expect(object?.httpMetadata?.contentType).toBe("image/webp");
    expect(object?.httpMetadata?.cacheControl).toContain("immutable");

    const store = await panelRequest(fixture, "GET", "/panel/store");
    expect(await readJson(store)).toMatchObject({ logoKey: body.logoKey, logoUrl: body.logoUrl });
  });

  it("rechaza MIME/magic inválido, exceso de peso y ancho mayor de 1600", async () => {
    const fixture = await createStore();

    const notWebp = new FormData();
    notWebp.append("logo", new File([pngBytes()], "logo.png", { type: "image/png" }));
    const invalid = await panelMultipart(fixture, "/panel/store/logo", notWebp);
    expect(invalid.status).toBe(400);
    expect(await readJson(invalid)).toMatchObject({
      error: { code: "VALIDATION_ERROR", reason: "IMAGE_TYPE_INVALID" },
    });

    const tooLarge = new FormData();
    tooLarge.append(
      "logo",
      new File([webpImage(800, 400, { padToBytes: 2 * 1024 * 1024 + 1 })], "big.webp", {
        type: "image/webp",
      }),
    );
    expect((await panelMultipart(fixture, "/panel/store/logo", tooLarge)).status).toBe(400);

    expect(
      (await panelMultipart(fixture, "/panel/store/logo", logoForm(1601, 800))).status,
    ).toBe(400);

    const empty = new FormData();
    const missing = await panelMultipart(fixture, "/panel/store/logo", empty);
    expect(missing.status).toBe(400);
    expect(await readJson(missing)).toMatchObject({
      error: { reason: "IMAGE_MISSING" },
    });
  });
});

describe("suspensión y reactivación", () => {
  it("el dueño suspende (404 público) y reactiva; el panel sigue accesible", async () => {
    const fixture = await createStore();

    const suspend = await panelRequest(fixture, "POST", "/panel/store/suspend", {
      reason: "Vacaciones",
    });
    expect(suspend.status).toBe(200);
    expect(await readJson(suspend)).toMatchObject({
      status: "suspended",
      suspendedBy: "owner",
      suspendedReason: "Vacaciones",
    });

    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(404);

    const panel = await panelRequest(fixture, "GET", "/panel/store");
    expect(panel.status).toBe(200);
    expect(await readJson(panel)).toMatchObject({
      status: "suspended",
      suspendedBy: "owner",
    });

    const reactivate = await panelRequest(fixture, "POST", "/panel/store/reactivate");
    expect(reactivate.status).toBe(200);
    expect(await readJson(reactivate)).toMatchObject({
      status: "active",
      suspendedBy: null,
      suspendedReason: null,
    });
    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(200);
  });

  it("el dueño no puede reactivar ni pisar una suspensión administrativa", async () => {
    const fixture = await createStore();
    const admin = await createAdminSession();

    const suspended = await consoleRequest(
      admin,
      "POST",
      `/console/stores/${fixture.storeId}/suspend`,
      { reason: "Incumplimiento" },
    );
    expect(suspended.status).toBe(200);

    const reactivate = await panelRequest(fixture, "POST", "/panel/store/reactivate");
    expect(reactivate.status).toBe(403);
    expect(await readJson(reactivate)).toMatchObject({
      error: { code: "FORBIDDEN", reason: "STORE_SUSPENDED_BY_ADMIN" },
    });

    const suspend = await panelRequest(fixture, "POST", "/panel/store/suspend", {
      reason: "Otra cosa",
    });
    expect(suspend.status).toBe(403);

    // El console reactiva siempre.
    const adminReactivate = await consoleRequest(
      admin,
      "POST",
      `/console/stores/${fixture.storeId}/reactivate`,
    );
    expect(adminReactivate.status).toBe(200);
    expect(await readJson(adminReactivate)).toMatchObject({ status: "active" });
  });
});

describe("DELETE /panel/store", () => {
  it("exige contraseña y slug exactos antes de borrar", async () => {
    const fixture = await createStore();

    const wrongPassword = await panelRequest(fixture, "DELETE", "/panel/store", {
      password: "MalaContraseña1",
      confirmSlug: fixture.slug,
    });
    expect(wrongPassword.status).toBe(401);
    expect(await readJson(wrongPassword)).toMatchObject({
      error: { code: "UNAUTHORIZED", reason: "INVALID_PASSWORD" },
    });

    const wrongSlug = await panelRequest(fixture, "DELETE", "/panel/store", {
      password: STORE_PASSWORD,
      confirmSlug: "otra-tienda",
    });
    expect(wrongSlug.status).toBe(400);
    expect(await readJson(wrongSlug)).toMatchObject({
      error: { reason: "CONFIRM_SLUG_MISMATCH" },
    });

    const alive = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE id = ?")
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(alive?.total).toBe(1);
  });

  it("borra R2, D1 y la cuenta, reserva el slug 90 días y deja audit", async () => {
    const fixture = await createStore();
    const logo = await panelMultipart(fixture, "/panel/store/logo", logoForm());
    const { logoKey } = await readJson<{ logoKey: string }>(logo);
    expect(await testEnv.MEDIA_BUCKET.get(logoKey)).toBeTruthy();

    const deleted = await panelRequest(fixture, "DELETE", "/panel/store", {
      password: STORE_PASSWORD,
      confirmSlug: fixture.slug,
    });
    expect(deleted.status).toBe(204);

    expect(await testEnv.MEDIA_BUCKET.get(logoKey)).toBeFalsy();

    const storeCount = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE id = ?")
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(storeCount?.total).toBe(0);

    const userCount = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM store_users WHERE email = ?",
    )
      .bind(fixture.email)
      .first<{ total: number }>();
    expect(userCount?.total).toBe(0);

    const reservation = await testEnv.DB.prepare(
      "SELECT reason, reserved_until FROM slug_reservation WHERE slug = ?",
    )
      .bind(fixture.slug)
      .first<{ reason: string; reserved_until: number }>();
    expect(reservation?.reason).toBe("deleted");
    expect(reservation!.reserved_until).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);

    const audit = await testEnv.DB.prepare(
      "SELECT actor_type, action, store_slug FROM audit_log WHERE store_id = ?",
    )
      .bind(fixture.storeId)
      .first<{ actor_type: string; action: string; store_slug: string }>();
    expect(audit).toMatchObject({
      actor_type: "owner",
      action: "store.delete",
      store_slug: fixture.slug,
    });

    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(404);

    // La sesión quedó invalidada con el borrado de la cuenta.
    const panel = await panelRequest(fixture, "GET", "/panel/store");
    expect([401, 404]).toContain(panel.status);
  });

  it("con R2 fallando responde 502 y no toca D1", async () => {
    const fixture = await createStore();
    const { hardDeleteStore } = await import("../src/services/store");
    const { createDb } = await import("@tucatalogo/db");
    const { getStoreById } = await import("../src/repositories/store");

    const db = createDb(testEnv.DB);
    const store = await getStoreById(db, fixture.storeId);
    expect(store).toBeTruthy();

    const failingBucket = {
      put: async () => {
        throw new Error("R2 caído");
      },
      get: async () => null,
      delete: async () => {
        throw new Error("R2 caído");
      },
      list: async () => {
        throw new Error("R2 caído");
      },
    };

    const failingEnv = { ...testEnv, MEDIA_BUCKET: failingBucket } as unknown as typeof testEnv;

    await expect(
      hardDeleteStore(failingEnv, db, store!, { type: "owner", id: "owner-1" }),
    ).rejects.toMatchObject({ code: "STORAGE_ERROR", status: 502 });

    const stillThere = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE id = ?")
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(stillThere?.total).toBe(1);

    const reservation = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM slug_reservation WHERE slug = ?",
    )
      .bind(fixture.slug)
      .first<{ total: number }>();
    expect(reservation?.total).toBe(0);
  });
});

describe("sesión de panel", () => {
  it("sin cookie es 401 y no emite cookies", async () => {
    const fixture = await createStore();
    const response = await api("/panel/store", {
      headers: { "x-store-slug": fixture.slug },
    });
    expect(response.status).toBe(401);
    expect(hasCookie(response, "store.session_token")).toBe(false);
  });
});
