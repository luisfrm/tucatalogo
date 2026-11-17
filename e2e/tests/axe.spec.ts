import { test, expect } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "../lib/axe";
import { CONSOLE_URL, QA_STORE, panelUrl, storefrontUrl } from "../lib/config";
import { readState } from "../lib/state";

/**
 * axe (PLAN §14 y §15.1 #11, mitad de accesibilidad):
 * home y ficha del storefront, login del panel y login del console.
 *
 * Se ejecuta sobre la tienda desechable (ya publicada) y sobre `qa-store`, que
 * es la tienda de referencia que no se borra. El listado del console se audita
 * en `console.spec.ts`, cuando existe sesión verificada.
 */
const state = readState();
const store = state.disposable;

test("axe: storefront (home y ficha)", async ({ page }) => {
  await page.goto(storefrontUrl(store.slug));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "storefront/home");

  await page.goto(`${storefrontUrl(store.slug)}/producto/producto-e2e-1`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "storefront/producto");

  // Modo oscuro: mismos componentes, otros tokens.
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await expectNoSeriousA11yViolations(page, "storefront/producto-dark");
});

test("axe: tienda de referencia qa-store", async ({ page }) => {
  await page.goto(storefrontUrl(QA_STORE.slug));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "storefront/qa-store");
});

test("axe: login del panel y login del console", async ({ page }) => {
  await page.goto(panelUrl(store.slug, "login"));
  await expect(page.getByRole("heading", { name: "Entra a tu tienda" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "panel-admin/login");

  await page.goto(`${CONSOLE_URL}/login`);
  await expect(page.getByRole("heading", { name: "Acceso al console" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "console/login");

  await page.goto(`${CONSOLE_URL}/init`);
  await expectNoSeriousA11yViolations(page, "console/init");
});
