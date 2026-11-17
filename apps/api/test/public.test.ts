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
import { logoForm, productImageForm } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

async function createCategory(fixture: StoreFixture, name: string, slug: string) {
  const response = await panelRequest(fixture, "POST", "/panel/categories", { name, slug });
  expect(response.status).toBe(201);
  return readJson<{ id: string; slug: string }>(response);
}

async function createProduct(
  fixture: StoreFixture,
  input: Record<string, unknown>,
): Promise<{ id: string; slug: string }> {
  const response = await panelRequest(fixture, "POST", "/panel/products", {
    name: "Producto",
    priceMinor: 1999,
    ...input,
  });
  if (response.status !== 201) throw new Error(await response.text());
  return readJson<{ id: string; slug: string }>(response);
}

describe("GET /public/:slug/store", () => {
  it("devuelve tema, moneda, WhatsApp y logo de la tienda activa", async () => {
    const fixture = await createStore({
      currency: "COP",
      themeId: "velvet-noir",
      whatsappNumber: "584121234567",
    });
    const logo = await panelMultipart(fixture, "/panel/store/logo", logoForm());
    const { logoUrl } = await readJson<{ logoUrl: string }>(logo);

    const response = await getJson(`/public/${fixture.slug}/store`);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      slug: fixture.slug,
      name: "Tienda Ejemplo",
      themeId: "velvet-noir",
      currency: "COP",
      colorModeDefault: "light",
      whatsappNumber: "584121234567",
      logoUrl,
    });
  });

  it("404 idéntico para inexistente, suspendida y eliminada", async () => {
    const missing = await getJson("/public/no-existe-esta-tienda/store");
    expect(missing.status).toBe(404);
    const missingBody = await readJson<{ error: { code: string; message: string } }>(missing);

    const suspended = await createStore();
    await panelRequest(suspended, "POST", "/panel/store/suspend", { reason: "Prueba" });
    const suspendedResponse = await getJson(`/public/${suspended.slug}/store`);
    expect(suspendedResponse.status).toBe(404);
    const suspendedBody = await readJson<{ error: { code: string; message: string } }>(
      suspendedResponse,
    );
    expect({ code: suspendedBody.error.code, message: suspendedBody.error.message }).toEqual({
      code: missingBody.error.code,
      message: missingBody.error.message,
    });

    const deleted = await createStore();
    const removal = await panelRequest(deleted, "DELETE", "/panel/store", {
      password: deleted.password,
      confirmSlug: deleted.slug,
    });
    expect(removal.status).toBe(204);
    const deletedResponse = await getJson(`/public/${deleted.slug}/store`);
    expect(deletedResponse.status).toBe(404);
    const deletedBody = await readJson<{ error: { code: string; message: string } }>(deletedResponse);
    expect({ code: deletedBody.error.code, message: deletedBody.error.message }).toEqual({
      code: missingBody.error.code,
      message: missingBody.error.message,
    });
  });

  it("un slug reservado o con formato inválido no revela nada", async () => {
    expect((await getJson("/public/www/store")).status).toBe(404);
    expect((await getJson("/public/-mal-/store")).status).toBe(404);
  });
});

describe("GET /public/:slug/products", () => {
  it("solo lista activos y no borrados, con paginación de 24", async () => {
    const fixture = await createStore();
    const visible = await createProduct(fixture, { name: "Visible", slug: "visible" });
    await createProduct(fixture, { name: "Oculto", slug: "oculto", isActive: false });
    const removed = await createProduct(fixture, { name: "Borrado", slug: "borrado" });
    expect((await panelRequest(fixture, "DELETE", `/panel/products/${removed.id}`)).status).toBe(
      204,
    );

    const response = await getJson(`/public/${fixture.slug}/products`);
    expect(response.status).toBe(200);
    const body = await readJson<{
      items: { id: string; slug: string; currency: string }[];
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    }>(response);

    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(24);
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.items.map((item) => item.slug)).toEqual([visible.slug]);
    expect(body.items[0]).toMatchObject({ currency: "USD" });
  });

  it("filtra por slug de categoría y busca por nombre", async () => {
    const fixture = await createStore();
    const shoes = await createCategory(fixture, "Zapatos", "zapatos");
    await createCategory(fixture, "Maquillaje", "maquillaje");

    await createProduct(fixture, {
      name: "Sandalia roja",
      slug: "sandalia-roja",
      categoryId: shoes.id,
    });
    await createProduct(fixture, { name: "Labial rojo", slug: "labial-rojo" });
    await createProduct(fixture, { name: "Sandalia azul", slug: "sandalia-azul", isActive: false });

    const byCategory = await getJson(`/public/${fixture.slug}/products?category=zapatos`);
    const categoryBody = await readJson<{ items: { slug: string; categorySlug: string | null }[] }>(
      byCategory,
    );
    expect(categoryBody.items.map((item) => item.slug)).toEqual(["sandalia-roja"]);
    expect(categoryBody.items[0]?.categorySlug).toBe("zapatos");

    const bySearch = await getJson(`/public/${fixture.slug}/products?q=SANDALIA`);
    const searchBody = await readJson<{ total: number; items: { slug: string }[] }>(bySearch);
    expect(searchBody.total).toBe(1);
    expect(searchBody.items[0]?.slug).toBe("sandalia-roja");

    const unknownCategory = await getJson(`/public/${fixture.slug}/products?category=nope`);
    expect(unknownCategory.status).toBe(404);
    expect(await readJson(unknownCategory)).toMatchObject({
      error: { code: "NOT_FOUND", reason: "CATEGORY_NOT_FOUND" },
    });

    const badPage = await getJson(`/public/${fixture.slug}/products?page=abc`);
    expect(badPage.status).toBe(400);
  });

  it("devuelve la imagen principal con URLs de MEDIA_BASE_URL", async () => {
    const fixture = await createStore();
    const product = await createProduct(fixture, { name: "Con foto", slug: "con-foto" });

    const upload = await panelMultipart(
      fixture,
      `/panel/products/${product.id}/images`,
      productImageForm({ alt: "Sandalia" }),
    );
    expect(upload.status).toBe(201);
    const image = await readJson<{ fullUrl: string; thumbUrl: string }>(upload);

    const list = await getJson(`/public/${fixture.slug}/products`);
    const body = await readJson<{
      items: { image: { fullUrl: string; thumbUrl: string; alt: string } | null }[];
    }>(list);

    expect(body.items[0]?.image).toMatchObject({
      fullUrl: image.fullUrl,
      thumbUrl: image.thumbUrl,
      alt: "Sandalia",
    });
    expect(image.fullUrl.startsWith("http://127.0.0.1:9797/media/stores/")).toBe(true);
    expect(image.fullUrl.endsWith("-full.webp")).toBe(true);
    expect(image.thumbUrl.endsWith("-thumb.webp")).toBe(true);
  });
});

describe("GET /public/:slug/products/:productSlug", () => {
  it("devuelve la ficha con imágenes, categoría y enlace de WhatsApp", async () => {
    const fixture = await createStore({ whatsappNumber: "584121234567" });
    const category = await createCategory(fixture, "Zapatos", "zapatos");
    const product = await createProduct(fixture, {
      name: "Sandalia roja",
      slug: "sandalia-roja",
      description: "Sandalias cómodas",
      priceMinor: 2500,
      categoryId: category.id,
    });
    await panelMultipart(fixture, `/panel/products/${product.id}/images`, productImageForm());

    const response = await getJson(`/public/${fixture.slug}/products/sandalia-roja`);
    expect(response.status).toBe(200);
    const body = await readJson<{
      name: string;
      currency: string;
      description: string;
      category: { slug: string };
      images: { fullUrl: string; thumbUrl: string }[];
      whatsappUrl: string | null;
    }>(response);

    expect(body).toMatchObject({
      name: "Sandalia roja",
      currency: "USD",
      description: "Sandalias cómodas",
      category: { slug: "zapatos" },
    });
    expect(body.images).toHaveLength(1);
    expect(body.whatsappUrl).toContain("https://wa.me/584121234567?text=");
    expect(decodeURIComponent(body.whatsappUrl!)).toContain("Sandalia roja");
  });

  it("404 si el producto no existe, está oculto o fue borrado", async () => {
    const fixture = await createStore();
    expect((await getJson(`/public/${fixture.slug}/products/nada`)).status).toBe(404);

    const hidden = await createProduct(fixture, { name: "Oculto", slug: "oculto", isActive: false });
    expect((await getJson(`/public/${fixture.slug}/products/${hidden.slug}`)).status).toBe(404);

    const removed = await createProduct(fixture, { name: "Borrado", slug: "borrado" });
    await panelRequest(fixture, "DELETE", `/panel/products/${removed.id}`);
    expect((await getJson(`/public/${fixture.slug}/products/${removed.slug}`)).status).toBe(404);
  });

  it("no filtra el WhatsApp de otra tienda ni acepta el producto de otra tienda", async () => {
    const storeA = await createStore({
      whatsappNumber: "584121234567",
      email: "a@example.com",
      slug: "tienda-a",
    });
    const storeB = await createStore({ slug: "tienda-b" });
    await createProduct(storeA, { name: "Solo A", slug: "solo-a" });
    await createProduct(storeB, { name: "Solo B", slug: "solo-b" });

    expect((await getJson(`/public/${storeB.slug}/products/solo-a`)).status).toBe(404);

    const detail = await getJson(`/public/${storeA.slug}/products/solo-a`);
    expect(await readJson(detail)).toMatchObject({ whatsappUrl: expect.stringContaining("584121234567") });
    expect(await readJson(await getJson(`/public/${storeB.slug}/products/solo-b`))).toMatchObject({
      whatsappUrl: null,
    });
  });
});

describe("GET /public/:slug/sitemap", () => {
  it("lista solo categorías y productos vivos, con updatedAt", async () => {
    const fixture = await createStore();
    const category = await createCategory(fixture, "Zapatos", "zapatos");
    await createProduct(fixture, { name: "Visible", slug: "visible", categoryId: category.id });
    const removed = await createProduct(fixture, { name: "Borrado", slug: "borrado" });
    await panelRequest(fixture, "DELETE", `/panel/products/${removed.id}`);

    const response = await getJson(`/public/${fixture.slug}/sitemap`);
    expect(response.status).toBe(200);
    const body = await readJson<{
      categories: { slug: string; updatedAt: string }[];
      products: { slug: string; updatedAt: string }[];
    }>(response);

    expect(body.categories.map((entry) => entry.slug)).toEqual(["zapatos"]);
    expect(body.products.map((entry) => entry.slug)).toEqual(["visible"]);
    expect(Number.isNaN(Date.parse(body.products[0]!.updatedAt))).toBe(false);
  });

  it("404 si la tienda está suspendida", async () => {
    const fixture = await createStore();
    await panelRequest(fixture, "POST", "/panel/store/suspend", {});
    expect((await getJson(`/public/${fixture.slug}/sitemap`)).status).toBe(404);
    expect((await getJson(`/public/${fixture.slug}/hero`)).status).toBe(404);
    expect((await getJson(`/public/${fixture.slug}/products`)).status).toBe(404);
  });
});

describe("R2 local", () => {
  it("las keys de media viven bajo stores/<storeId>/", async () => {
    const fixture = await createStore();
    const product = await createProduct(fixture, { name: "Con foto", slug: "con-foto" });
    const upload = await panelMultipart(
      fixture,
      `/panel/products/${product.id}/images`,
      productImageForm(),
    );
    const image = await readJson<{ fullUrl: string }>(upload);
    const key = image.fullUrl.replace("http://127.0.0.1:9797/media/", "");

    expect(key.startsWith(`stores/${fixture.storeId}/products/${product.id}/`)).toBe(true);
    expect(await testEnv.MEDIA_BUCKET.get(key)).toBeTruthy();
  });
});
