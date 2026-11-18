import { test, expect } from "@playwright/test";

import { CONSOLE_URL, panelUrl, storefrontUrl } from "../lib/config";
import { currentTotp } from "../lib/totp";
import { readState } from "../lib/state";

/**
 * Eliminación de la tienda desechable (PLAN §15.1 #13 / §15.2 #17):
 * confirmación por slug, hard delete + cuarentena, audit y `store_users` borrados.
 *
 * Vive en su propio proyecto porque **deja el estado final** de la ejecución:
 * depende de todos los proyectos que usan la tienda, y así un fallo de axe (o
 * de cualquier flujo) no impide que los demás se ejecuten y reporten. Si algún
 * proyecto previo falla, este se salta y la tienda queda en D1; el repositorio
 * trae `e2e/scripts/cleanup-stores.mjs` para ese caso.
 */
test("elimina la tienda desechable con confirmación, audit y cuarentena", async ({ page }) => {
  test.setTimeout(180_000);
  const state = readState();
  const store = state.disposable;
  const admin = state.consoleAdmin ?? null;
  test.skip(!admin, "El alta del console no corrió en esta pasada: no hay admin que reutilizar.");
  if (!admin) return;

  await page.goto(`${CONSOLE_URL}/login`);
  await page.locator("#email").fill(admin.email);
  await page.locator("#password").fill(admin.password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2fa/, { timeout: 30_000 });
  await page.locator("#code").fill(await currentTotp(admin.totpSecret));
  await page.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });

  await page.goto(`${CONSOLE_URL}/?q=${encodeURIComponent(store.slug)}`);
  await page.getByRole("link", { name: store.storeName }).first().click();

  await page.getByRole("button", { name: "Eliminar tienda" }).click();
  await page.getByRole("dialog").locator("#confirm-slug").fill(store.slug);
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar definitivamente" }).click();

  await expect(page).toHaveURL(new RegExp(`/\\?eliminada=${store.slug}`), { timeout: 30_000 });
  await expect(page.getByText("Tienda eliminada")).toBeVisible();

  // Storefront permanente 404 y slug en cuarentena (rechazado con motivo).
  expect((await page.goto(storefrontUrl(store.slug)))?.status()).toBe(404);

  const slugCheck = await page.goto(
    `http://localhost:5174/registro/slug-check?slug=${store.slug}`,
  );
  expect(slugCheck?.status()).toBe(200);
  const payload = JSON.parse(await page.locator("body").innerText()) as {
    available: boolean;
    reason?: string;
  };
  expect(payload.available).toBe(false);
  expect(payload.reason).toBe("quarantined");

  // El login del dueño ya no existe: su cuenta se borró con la tienda.
  const loginAfterDelete = await page.goto(panelUrl(store.slug, "login"));
  expect([404, 200]).toContain(loginAfterDelete?.status());

  // qa-store sigue intacta.
  expect((await page.goto(storefrontUrl(state.qaStore!.slug)))?.status()).toBe(200);
});
