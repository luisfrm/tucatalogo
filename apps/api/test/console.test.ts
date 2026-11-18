import { beforeEach, describe, expect, it } from "vitest";

import { testEnv } from "./env";
import {
  consoleRequest,
  createAdminSession,
  createStore,
  panelMultipart,
  panelRequest,
  readJson,
  resetAdminRealm,
} from "./fixtures";
import { api, cookiePair, getJson, postJson, totp, totpSecretFromUri } from "./helpers";
import { heroForm, productImageForm } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

describe("GET /console/stores", () => {
  it("lista, busca por slug/nombre/email y filtra por estado", async () => {
    const admin = await createAdminSession();
    const storeA = await createStore({ slug: "alpha-store", email: "alpha@example.com" });
    const storeB = await createStore({ slug: "beta-store", email: "beta@example.com" });
    expect(storeB.slug).toBe("beta-store");

    const list = await consoleRequest(admin, "GET", "/console/stores");
    expect(list.status).toBe(200);
    const body = await readJson<{
      items: { id: string; slug: string; ownerEmail: string }[];
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    }>(list);

    expect(body.pageSize).toBe(20);
    expect(body.total).toBe(2);
    expect(body.items.map((item) => item.slug).sort()).toEqual(["alpha-store", "beta-store"]);

    const bySlug = await consoleRequest(admin, "GET", "/console/stores?q=alpha");
    expect(await readJson<{ total: number }>(bySlug)).toMatchObject({ total: 1 });

    const byEmail = await consoleRequest(admin, "GET", "/console/stores?q=beta@example.com");
    expect(await readJson<{ total: number }>(byEmail)).toMatchObject({ total: 1 });

    await consoleRequest(admin, "POST", `/console/stores/${storeA.storeId}/suspend`, {
      reason: "Prueba",
    });
    const suspended = await consoleRequest(admin, "GET", "/console/stores?status=suspended");
    const suspendedBody = await readJson<{ items: { id: string }[] }>(suspended);
    expect(suspendedBody.items.map((item) => item.id)).toEqual([storeA.storeId]);

    const badStatus = await consoleRequest(admin, "GET", "/console/stores?status=nope");
    expect(badStatus.status).toBe(400);
  });

  it("el detalle trae owner, metadatos y conteos, sin contenido editable", async () => {
    const admin = await createAdminSession();
    const fixture = await createStore();

    const category = await panelRequest(fixture, "POST", "/panel/categories", {
      name: "Zapatos",
      slug: "zapatos",
    });
    const categoryId = (await readJson<{ id: string }>(category)).id;
    const product = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Sandalia",
      slug: "sandalia",
      priceMinor: 1000,
      categoryId,
    });
    const productId = (await readJson<{ id: string }>(product)).id;
    await panelMultipart(fixture, `/panel/products/${productId}/images`, productImageForm());
    await panelMultipart(fixture, "/panel/hero", heroForm({ title: "Slide" }));

    const detail = await consoleRequest(admin, "GET", `/console/stores/${fixture.storeId}`);
    expect(detail.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(detail);

    expect(body).toMatchObject({
      id: fixture.storeId,
      slug: fixture.slug,
      ownerEmail: fixture.email,
      status: "active",
      productCount: 1,
      categoryCount: 1,
      slideCount: 1,
      imageCount: 1,
    });
    expect(JSON.stringify(body)).not.toContain("Zapatos");
    expect(JSON.stringify(body)).not.toContain("Sandalia");

    expect((await consoleRequest(admin, "GET", "/console/stores/nope")).status).toBe(404);
  });
});

describe("suspensión del console", () => {
  it("exige motivo, deja audit y bloquea el storefront; reactivar lo reabre", async () => {
    const admin = await createAdminSession();
    const fixture = await createStore();

    const missingReason = await consoleRequest(
      admin,
      "POST",
      `/console/stores/${fixture.storeId}/suspend`,
      { reason: "" },
    );
    expect(missingReason.status).toBe(400);

    const suspended = await consoleRequest(
      admin,
      "POST",
      `/console/stores/${fixture.storeId}/suspend`,
      { reason: "Incumplimiento" },
    );
    expect(suspended.status).toBe(200);
    expect(await readJson(suspended)).toMatchObject({
      status: "suspended",
      suspendedBy: "admin",
      suspendedReason: "Incumplimiento",
    });
    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(404);

    const audit = await testEnv.DB.prepare(
      "SELECT actor_type, actor_id, action FROM audit_log WHERE store_id = ? AND action = 'store.suspend'",
    )
      .bind(fixture.storeId)
      .first<{ actor_type: string; actor_id: string; action: string }>();
    expect(audit).toMatchObject({ actor_type: "admin", actor_id: admin.adminId });

    const reactivated = await consoleRequest(
      admin,
      "POST",
      `/console/stores/${fixture.storeId}/reactivate`,
    );
    expect(reactivated.status).toBe(200);
    expect(await readJson(reactivated)).toMatchObject({ status: "active", suspendedBy: null });
    expect((await getJson(`/public/${fixture.slug}/store`)).status).toBe(200);

    const reactivateAudit = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM audit_log WHERE store_id = ? AND action = 'store.reactivate'",
    )
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(reactivateAudit?.total).toBe(1);
  });
});

describe("DELETE /console/stores/:id", () => {
  it("exige el slug exacto y borra R2 + D1 dejando audit y cuarentena", async () => {
    const admin = await createAdminSession();
    const fixture = await createStore();

    const product = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Sandalia",
      slug: "sandalia",
      priceMinor: 1000,
    });
    const productId = (await readJson<{ id: string }>(product)).id;
    const image = await panelMultipart(
      fixture,
      `/panel/products/${productId}/images`,
      productImageForm(),
    );
    const { fullUrl } = await readJson<{ fullUrl: string }>(image);
    const fullKey = fullUrl.replace("http://127.0.0.1:9797/media/", "");

    const wrongSlug = await consoleRequest(
      admin,
      "DELETE",
      `/console/stores/${fixture.storeId}`,
      { confirmSlug: "otra" },
    );
    expect(wrongSlug.status).toBe(400);

    const deleted = await consoleRequest(
      admin,
      "DELETE",
      `/console/stores/${fixture.storeId}`,
      { confirmSlug: fixture.slug },
    );
    expect(deleted.status).toBe(204);

    expect(await testEnv.MEDIA_BUCKET.get(fullKey)).toBeFalsy();

    const storeCount = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE id = ?")
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(storeCount?.total).toBe(0);

    const reservation = await testEnv.DB.prepare(
      "SELECT reserved_until FROM slug_reservation WHERE slug = ?",
    )
      .bind(fixture.slug)
      .first<{ reserved_until: number }>();
    expect(reservation!.reserved_until).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);

    const audit = await testEnv.DB.prepare(
      "SELECT actor_type, action FROM audit_log WHERE store_id = ? AND action = 'store.delete'",
    )
      .bind(fixture.storeId)
      .first<{ actor_type: string; action: string }>();
    expect(audit).toMatchObject({ actor_type: "admin", action: "store.delete" });

    expect((await consoleRequest(admin, "GET", `/console/stores/${fixture.storeId}`)).status).toBe(
      404,
    );
  });
});

describe("GET /console/audit", () => {
  it("es solo lectura y filtra por tienda y acción", async () => {
    const admin = await createAdminSession();
    const fixture = await createStore();
    await consoleRequest(admin, "POST", `/console/stores/${fixture.storeId}/suspend`, {
      reason: "Motivo",
    });
    await consoleRequest(admin, "POST", `/console/stores/${fixture.storeId}/reactivate`);

    const all = await consoleRequest(admin, "GET", "/console/audit");
    expect(all.status).toBe(200);
    const body = await readJson<{
      items: { action: string; metadata: Record<string, unknown> | null }[];
      pageSize: number;
    }>(all);
    expect(body.pageSize).toBe(20);
    expect(body.items.map((item) => item.action)).toEqual(
      expect.arrayContaining(["store.suspend", "store.reactivate"]),
    );
    const suspendEntry = body.items.find((item) => item.action === "store.suspend");
    expect(suspendEntry?.metadata).toMatchObject({ reason: "Motivo" });

    const filtered = await consoleRequest(
      admin,
      "GET",
      `/console/audit?storeId=${fixture.storeId}&action=store.suspend`,
    );
    expect(await readJson<{ total: number }>(filtered)).toMatchObject({ total: 1 });

    const write = await consoleRequest(admin, "DELETE", "/console/audit");
    expect(write.status).toBe(404);
  });
});

describe("aislamiento de reinos", () => {
  it("una cookie de tienda no abre el console y una de console no abre el panel", async () => {
    const admin = await createAdminSession();
    const fixture = await createStore();

    const withStoreCookie = await api("/console/stores", {
      headers: { cookie: fixture.cookie },
    });
    expect(withStoreCookie.status).toBe(401);

    const withAdminCookie = await api("/panel/store", {
      headers: { cookie: admin.cookie, "x-store-slug": fixture.slug },
    });
    expect(withAdminCookie.status).toBe(401);

    const anonymous = await api("/console/stores");
    expect(anonymous.status).toBe(401);
  });

  it("exige 2FA: una sesión de console sin verificar no abre el backoffice", async () => {
    const init = await postJson("/auth/console/init", {
      name: "Admin",
      email: "pendiente@example.com",
      password: "AdminContraseña1",
    });
    expect(init.status).toBe(201);
    const body = (await init.json()) as { totpUri: string; enrollmentToken: string };
    expect(totpSecretFromUri(body.totpUri)).toBeTruthy();

    // M1: `/init` ya no emite sesión. Sin cookie, el backoffice no abre.
    const anonymous = await api("/console/stores");
    expect(anonymous.status).toBe(401);

    // Ni siquiera usar el challenge de enrolamiento como cookie da acceso.
    const forged = await api("/console/stores", {
      headers: { cookie: `console.session_token=${body.enrollmentToken}` },
    });
    expect(forged.status).toBe(401);

    // Una sesión real cuyo 2FA no está verificado en D1 tampoco (M1).
    const verify = await postJson("/auth/console/2fa/verify", {
      code: await totp(totpSecretFromUri(body.totpUri)),
      enrollmentToken: body.enrollmentToken,
    });
    expect(verify.status).toBe(204);
    const cookie = cookiePair(verify, "console.session_token");
    expect((await api("/console/stores", { headers: { cookie } })).status).toBe(200);

    await testEnv.DB.prepare("UPDATE admin_two_factor SET verified = 0").run();
    const blocked = await api("/console/stores", { headers: { cookie } });
    expect(blocked.status).toBe(403);
    expect(await readJson(blocked)).toMatchObject({
      error: { code: "FORBIDDEN", reason: "TWO_FACTOR_REQUIRED" },
    });
  });
});
