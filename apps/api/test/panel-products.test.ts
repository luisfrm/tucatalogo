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
import { productImageForm, pngBytes, webpImage } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

interface ProductBody {
  id: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  currency: string;
  images: { id: string }[];
}

async function createProduct(
  fixture: StoreFixture,
  input: Record<string, unknown>,
): Promise<{ response: Response; body: ProductBody }> {
  const response = await panelRequest(fixture, "POST", "/panel/products", {
    name: "Producto",
    priceMinor: 1999,
    ...input,
  });
  return { response, body: await readJson<ProductBody>(response) };
}

describe("CRUD de productos", () => {
  it("crea, lista, edita, cambia estado y borra lógicamente", async () => {
    const fixture = await createStore();

    const created = await createProduct(fixture, { name: "Sandalia", slug: "sandalia" });
    expect(created.response.status).toBe(201);
    const product = created.body;
    expect(product).toMatchObject({
      slug: "sandalia",
      isActive: true,
      currency: "USD",
      images: [],
    });
    expect(product.sortOrder).toBe(1);

    const list = await panelRequest(fixture, "GET", "/panel/products");
    expect(list.status).toBe(200);
    expect(await readJson(list)).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      hasMore: false,
    });

    const patched = await panelRequest(fixture, "PATCH", `/panel/products/${product.id}`, {
      name: "Sandalia roja",
      priceMinor: 2599,
      description: "Cuero",
    });
    expect(patched.status).toBe(200);
    expect(await readJson(patched)).toMatchObject({
      name: "Sandalia roja",
      priceMinor: 2599,
      description: "Cuero",
    });

    const status = await panelRequest(fixture, "PATCH", `/panel/products/${product.id}/status`, {
      isActive: false,
    });
    expect(status.status).toBe(200);
    expect(await readJson(status)).toMatchObject({ isActive: false });

    const searchHidden = await panelRequest(
      fixture,
      "GET",
      "/panel/products?status=inactive",
    );
    expect(await readJson<{ total: number }>(searchHidden)).toMatchObject({ total: 1 });

    const deleted = await panelRequest(fixture, "DELETE", `/panel/products/${product.id}`);
    expect(deleted.status).toBe(204);

    const row = await testEnv.DB.prepare("SELECT is_deleted FROM product WHERE id = ?")
      .bind(product.id)
      .first<{ is_deleted: number }>();
    expect(row?.is_deleted).toBe(1);

    expect((await panelRequest(fixture, "GET", `/panel/products/${product.id}`)).status).toBe(404);
    expect((await panelRequest(fixture, "DELETE", `/panel/products/${product.id}`)).status).toBe(
      404,
    );
  });

  it("rechaza slug duplicado (409), entrada inválida (400) y categoría ajena (400)", async () => {
    const fixture = await createStore();
    const other = await createStore();

    await createProduct(fixture, { name: "Uno", slug: "repetido" });
    const duplicate = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Dos",
      slug: "repetido",
      priceMinor: 100,
    });
    expect(duplicate.status).toBe(409);
    expect(await readJson(duplicate)).toMatchObject({
      error: { code: "CONFLICT", reason: "PRODUCT_SLUG_TAKEN" },
    });

    const invalidPrice = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Malo",
      slug: "malo",
      priceMinor: -1,
    });
    expect(invalidPrice.status).toBe(400);
    expect(await readJson(invalidPrice)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const foreignCategory = await panelRequest(other, "POST", "/panel/categories", {
      name: "Ajena",
      slug: "ajena",
    });
    const category = await readJson<{ id: string }>(foreignCategory);

    const withForeignCategory = await panelRequest(fixture, "POST", "/panel/products", {
      name: "Con categoría ajena",
      slug: "categoria-ajena",
      priceMinor: 100,
      categoryId: category.id,
    });
    expect(withForeignCategory.status).toBe(400);
    expect(await readJson(withForeignCategory)).toMatchObject({
      error: { reason: "CATEGORY_NOT_FOUND" },
    });
  });

  it("aísla tiendas en GET/PATCH/DELETE y en el reordenamiento", async () => {
    const storeA = await createStore();
    const storeB = await createStore();

    const { body: productB } = await createProduct(storeB, { name: "B", slug: "producto-b" });
    const bId = productB.id;

    expect((await panelRequest(storeA, "GET", `/panel/products/${bId}`)).status).toBe(404);
    expect(
      (await panelRequest(storeA, "PATCH", `/panel/products/${bId}`, { name: "Hackeado" })).status,
    ).toBe(404);
    expect((await panelRequest(storeA, "DELETE", `/panel/products/${bId}`)).status).toBe(404);
    const foreignList = await panelRequest(storeA, "GET", "/panel/products");
    expect(foreignList.status).toBe(200);
    expect(await readJson<{ total: number }>(foreignList)).toMatchObject({ total: 0 });
  });

  it("reordena solo con el conjunto exacto de productos vivos", async () => {
    const fixture = await createStore();
    const first = await createProduct(fixture, { name: "Uno", slug: "uno" });
    const second = await createProduct(fixture, { name: "Dos", slug: "dos" });
    const firstId = first.body.id;
    const secondId = second.body.id;

    const mismatch = await panelRequest(fixture, "PATCH", "/panel/products/reorder", {
      ids: [firstId],
    });
    expect(mismatch.status).toBe(400);
    expect(await readJson(mismatch)).toMatchObject({ error: { reason: "REORDER_MISMATCH" } });

    const reordered = await panelRequest(fixture, "PATCH", "/panel/products/reorder", {
      ids: [secondId, firstId],
    });
    expect(reordered.status).toBe(204);

    const list = await panelRequest(fixture, "GET", "/panel/products");
    const body = await readJson<{ items: { slug: string }[] }>(list);
    expect(body.items.map((item) => item.slug)).toEqual(["dos", "uno"]);
  });
});

describe("categorías", () => {
  it("crea, lista con conteo, edita y borra dejando productos sin categoría", async () => {
    const fixture = await createStore();

    const created = await panelRequest(fixture, "POST", "/panel/categories", {
      name: "Zapatos",
      slug: "zapatos",
    });
    expect(created.status).toBe(201);
    const category = await readJson<{ id: string; sortOrder: number }>(created);

    const duplicate = await panelRequest(fixture, "POST", "/panel/categories", {
      name: "Otra",
      slug: "zapatos",
    });
    expect(duplicate.status).toBe(409);
    expect(await readJson(duplicate)).toMatchObject({
      error: { code: "CONFLICT", reason: "CATEGORY_SLUG_TAKEN" },
    });

    const { body: product } = await createProduct(fixture, {
      name: "Sandalia",
      slug: "sandalia",
      categoryId: category.id,
    });

    const list = await panelRequest(fixture, "GET", "/panel/categories");
    expect(await readJson<{ items: { productCount: number }[] }>(list)).toMatchObject({
      items: [{ id: category.id, slug: "zapatos", productCount: 1 }],
    });

    const updated = await panelRequest(fixture, "PATCH", `/panel/categories/${category.id}`, {
      name: "Calzado",
      slug: "calzado",
    });
    expect(updated.status).toBe(200);
    expect(await readJson(updated)).toMatchObject({ name: "Calzado", slug: "calzado" });

    const deleted = await panelRequest(fixture, "DELETE", `/panel/categories/${category.id}`);
    expect(deleted.status).toBe(204);

    const productId = product.id;
    const row = await testEnv.DB.prepare("SELECT category_id FROM product WHERE id = ?")
      .bind(productId)
      .first<{ category_id: string | null }>();
    expect(row?.category_id).toBeNull();
    expect((await panelRequest(fixture, "GET", "/panel/categories")).status).toBe(200);
  });
});

describe("imágenes de producto", () => {
  it("sube full + thumb a R2 y lista la imagen con URLs", async () => {
    const fixture = await createStore();
    const { body: product } = await createProduct(fixture, { name: "Con foto", slug: "con-foto" });
    const productId = product.id;

    const upload = await panelMultipart(
      fixture,
      `/panel/products/${productId}/images`,
      productImageForm(),
    );
    expect(upload.status).toBe(201);
    const image = await readJson<{
      id: string;
      alt: string;
      width: number;
      height: number;
      fullUrl: string;
      thumbUrl: string;
    }>(upload);
    expect(image).toMatchObject({ alt: "Zapato de muestra", width: 1600, height: 1000 });

    const fullKey = image.fullUrl.replace("http://127.0.0.1:9797/media/", "");
    const thumbKey = image.thumbUrl.replace("http://127.0.0.1:9797/media/", "");
    expect(await testEnv.MEDIA_BUCKET.get(fullKey)).toBeTruthy();
    expect(await testEnv.MEDIA_BUCKET.get(thumbKey)).toBeTruthy();
    expect(fullKey.endsWith("-full.webp")).toBe(true);
    expect(thumbKey.endsWith("-thumb.webp")).toBe(true);

    const detail = await panelRequest(fixture, "GET", `/panel/products/${productId}`);
    expect(await readJson<{ images: { id: string }[] }>(detail)).toMatchObject({
      images: [{ id: image.id }],
    });
  });

  it("rechaza magic inválido, >2 MB, thumb >600 px y dimensiones declaradas falsas", async () => {
    const fixture = await createStore();
    const { body: product } = await createProduct(fixture, { name: "Foto", slug: "foto" });
    const productId = product.id;

    const notWebp = new FormData();
    notWebp.append("full", new File([pngBytes()], "full.png", { type: "image/png" }));
    notWebp.append(
      "thumb",
      new File([webpImage(600, 600)], "thumb.webp", { type: "image/webp" }),
    );
    notWebp.append("alt", "Mala");
    const invalid = await panelMultipart(fixture, `/panel/products/${productId}/images`, notWebp);
    expect(invalid.status).toBe(400);
    expect(await readJson(invalid)).toMatchObject({ error: { reason: "IMAGE_TYPE_INVALID" } });

    const heavy = new FormData();
    heavy.append(
      "full",
      new File([webpImage(1600, 1000, { padToBytes: 2 * 1024 * 1024 + 1 })], "full.webp", {
        type: "image/webp",
      }),
    );
    heavy.append(
      "thumb",
      new File([webpImage(600, 600)], "thumb.webp", { type: "image/webp" }),
    );
    heavy.append("alt", "Pesada");
    expect((await panelMultipart(fixture, `/panel/products/${productId}/images`, heavy)).status).toBe(
      400,
    );

    expect(
      (
        await panelMultipart(
          fixture,
          `/panel/products/${productId}/images`,
          productImageForm({ thumbWidth: 601 }),
        )
      ).status,
    ).toBe(400);

    const lying = productImageForm();
    lying.append("width", "999");
    const inferred = await panelMultipart(
      fixture,
      `/panel/products/${productId}/images`,
      lying,
    );
    expect(inferred.status).toBe(400);
    expect(await readJson(inferred)).toMatchObject({ error: { reason: "IMAGE_DIMENSIONS_INVALID" } });

    const total = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM product_image WHERE product_id = ?",
    )
      .bind(productId)
      .first<{ total: number }>();
    expect(total?.total).toBe(0);
  });

  it("si R2 falla al subir responde 502 y no inserta fila", async () => {
    const fixture = await createStore();
    const { body: product } = await createProduct(fixture, { name: "Fallo", slug: "fallo" });

    const { createDb } = await import("@tucatalogo/db");
    const { getStoreById } = await import("../src/repositories/store");
    const { addProductImage } = await import("../src/services/product");

    const db = createDb(testEnv.DB);
    const store = (await getStoreById(db, fixture.storeId))!;
    const failingBucket = {
      put: async () => {
        throw new Error("R2 caído");
      },
      get: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    };
    const failingEnv = { ...testEnv, MEDIA_BUCKET: failingBucket } as unknown as typeof testEnv;

    const bytes = webpImage(1600, 1000);
    await expect(
      addProductImage(failingEnv, db, store, product.id, {
        full: { bytes, width: 1600, height: 1000, size: bytes.byteLength },
        thumb: { bytes, width: 600, height: 600, size: bytes.byteLength },
        alt: "Fallo",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_ERROR", status: 502 });

    const count = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM product_image WHERE product_id = ?",
    )
      .bind(product.id)
      .first<{ total: number }>();
    expect(count?.total).toBe(0);
  });

  it("respeta el tope de 8 y permite editar, reordenar y borrar con R2", async () => {
    const fixture = await createStore();
    const { body: product } = await createProduct(fixture, { name: "Galería", slug: "galeria" });
    const productId = product.id;

    const ids: string[] = [];
    const urls: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const response = await panelMultipart(
        fixture,
        `/panel/products/${productId}/images`,
        productImageForm({ alt: `Imagen ${index + 1}` }),
      );
      expect(response.status).toBe(201);
      const image = await readJson<{ id: string; fullUrl: string }>(response);
      ids.push(image.id);
      urls.push(image.fullUrl);
    }

    const ninth = await panelMultipart(
      fixture,
      `/panel/products/${productId}/images`,
      productImageForm({ alt: "Novena" }),
    );
    expect(ninth.status).toBe(400);
    expect(await readJson(ninth)).toMatchObject({ error: { reason: "IMAGE_LIMIT_REACHED" } });

    const updated = await panelRequest(
      fixture,
      "PATCH",
      `/panel/products/${productId}/images/${ids[0]}`,
      { alt: "Alt editado" },
    );
    expect(updated.status).toBe(200);
    expect(await readJson(updated)).toMatchObject({ alt: "Alt editado" });

    const reordered = await panelRequest(
      fixture,
      "PATCH",
      `/panel/products/${productId}/images/order`,
      { ids: [...ids].reverse() },
    );
    expect(reordered.status).toBe(200);
    const reorderedBody = await readJson<{ images: { id: string }[] }>(reordered);
    expect(reorderedBody.images[0]?.id).toBe(ids[7]);

    const firstKey = urls[0]!.replace("http://127.0.0.1:9797/media/", "");
    expect(await testEnv.MEDIA_BUCKET.get(firstKey)).toBeTruthy();

    const removed = await panelRequest(
      fixture,
      "DELETE",
      `/panel/products/${productId}/images/${ids[0]}`,
    );
    expect(removed.status).toBe(204);

    expect(await testEnv.MEDIA_BUCKET.get(firstKey)).toBeFalsy();
    expect(await testEnv.MEDIA_BUCKET.get(firstKey.replace("-full.webp", "-thumb.webp"))).toBeFalsy();

    const count = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM product_image WHERE product_id = ?",
    )
      .bind(productId)
      .first<{ total: number }>();
    expect(count?.total).toBe(7);

    expect(
      (
        await panelRequest(fixture, "PATCH", `/panel/products/${productId}/images/order`, {
          ids: [ids[1]],
        })
      ).status,
    ).toBe(400);
  });
});
