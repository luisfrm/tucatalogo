import { test, expect } from "@playwright/test";

import {
  QA_STORE,
  disposableSlug,
  panelUrl,
  runId,
  storefrontUrl,
} from "../lib/config";
import { loginPanel, registerStore, storeExists } from "../lib/flows";
import { writeState, type E2eState, type StoreState } from "../lib/state";

/**
 * Proyecto `setup`: prepara el estado que consumen los demás proyectos.
 *
 * - Crea una tienda **desechable** `e2e-<timestamp>` con el registro real (UI).
 * - Garantiza la tienda de referencia `qa-store` (no se borra nunca).
 * - No toca el console: eso lo hace `console.spec.ts` porque `/init` es
 *   one-time y debe quedar auditado en el mismo proyecto que lo crea.
 */
test("prepara la tienda desechable y la tienda de referencia", async ({ page }) => {
  test.setTimeout(180_000);
  const id = runId();

  const disposable: StoreState = {
    slug: disposableSlug(id),
    email: `e2e-${id}@example.test`,
    password: "E2eStore2026!",
    passwordAfterReset: `E2eReset2026!${id.slice(-4)}`,
    name: "Dueña E2E",
    storeName: `Tienda E2E ${id}`,
  };

  // 1. Tienda de referencia. El repositorio la documenta como existente; si la
  //    D1 local está vacía se recrea con el mismo flujo real (nunca se borra).
  let qaStore: StoreState | null = null;
  if (await storeExists(page, QA_STORE.slug)) {
    qaStore = {
      slug: QA_STORE.slug,
      email: QA_STORE.email,
      password: QA_STORE.password,
      name: "Dueña QA",
      storeName: QA_STORE.storeName,
    };
  } else {
    await registerStore(page, {
      name: "Dueña QA",
      email: QA_STORE.email,
      password: QA_STORE.password,
      storeName: QA_STORE.storeName,
      slug: QA_STORE.slug,
      themeId: "nude-studio",
    });
    qaStore = {
      slug: QA_STORE.slug,
      email: QA_STORE.email,
      password: QA_STORE.password,
      name: "Dueña QA",
      storeName: QA_STORE.storeName,
    };
  }

  // 2. La tienda B debe tener al menos un producto para los tests de
  //    aislamiento (A no puede leerlo ni editarlo).
  const qaHome = await page.goto(storefrontUrl(QA_STORE.slug));
  expect(qaHome?.status(), "storefront de qa-store").toBe(200);

  await loginPanel(page, qaStore.slug, QA_STORE.email, QA_STORE.password);

  const listResponse = await page.goto(panelUrl(qaStore.slug, "productos"));
  expect(listResponse?.status(), "listado de productos de qa-store").toBe(200);
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
  const empty = await page.getByText("Todavía no hay productos").isVisible();

  if (!empty) {
    // Ya tiene catálogo: se anota el id del primer producto (para aislamiento).
    const html = await page.content();
    const match = html.match(/\/panel-admin\/productos\/([0-9a-f-]{36})/);
    if (match?.[1]) qaStore.productId = match[1];
    await page.goto(storefrontUrl(QA_STORE.slug));
    const slugMatch = (await page.content()).match(/href="\/producto\/([a-z0-9-]+)"/);
    if (slugMatch?.[1]) qaStore.productSlug = slugMatch[1];
  } else {
    await page.goto(panelUrl(qaStore.slug, "productos/nuevo"));
    const nameInput = page.locator('form input[name="name"]').first();
    await nameInput.waitFor();
    await nameInput.fill("Producto QA");
    await page.locator('form input[name="slug"]').first().fill("producto-qa");
    await page.locator('form input[name="price"]').first().fill("19,90");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page).toHaveURL(/\/panel-admin\/productos\/(?!nuevo$)[^/]+$/, { timeout: 30_000 });
    const productId = new URL(page.url()).pathname.split("/").pop();
    qaStore.productId = productId;
    qaStore.productSlug = "producto-qa";
  }

  // 3. Tienda desechable (registro real por UI).
  const result = await registerStore(page, {
    name: disposable.name,
    email: disposable.email,
    password: disposable.password,
    storeName: disposable.storeName,
    slug: disposable.slug,
    currency: "EUR",
    themeId: "rose",
  });
  expect(result.storefront).toContain(disposable.slug);
  expect(result.panel).toContain("/panel-admin");
  expect((await page.goto(storefrontUrl(disposable.slug)))?.status()).toBe(200);

  const state: E2eState = {
    runId: id,
    startedAt: new Date().toISOString(),
    disposable,
    qaStore,
    consoleAdmin: null,
  };
  writeState(state);
});
