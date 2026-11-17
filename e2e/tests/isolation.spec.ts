import { test, expect } from "@playwright/test";

import { panelUrl, storefrontUrl } from "../lib/config";
import { panelStatePath, readState } from "../lib/state";

/**
 * Aislamiento entre tiendas (PLAN §7.8 y §15.1 #7).
 *
 * La sesión de la tienda A no puede leer ni escribir datos de B. Se comprueba
 * con cabeceras `cookie` explícitas: eso reproduce el ataque real (copiar la
 * cookie a otro host), que el navegador por sí solo no permitiría porque las
 * cookies son host-only.
 *
 * La sesión se reutiliza desde `e2e/.state/panel.json` (la guarda el proyecto
 * `panel`) para no consumir el rate limit de login.
 *
 * El aislamiento entre reinos se cubre con cookies reales en `console.spec.ts`.
 */
test.use({ storageState: panelStatePath() });

const state = readState();
const storeA = state.disposable;
const storeB = state.qaStore!;

test("la cookie de la tienda A no abre el panel de B", async ({ page, context }) => {
  await page.goto(panelUrl(storeA.slug));
  await expect(page.getByRole("link", { name: /Productos/ }).first()).toBeVisible();

  const cookies = await context.cookies();
  const sessionA = cookies.find((cookie) => cookie.name.includes("session_token"));
  expect(sessionA, "cookie de sesión de la tienda A").toBeTruthy();
  expect(sessionA!.domain.startsWith("."), "la cookie de tienda es host-only").toBe(false);

  const foreignHost = await context.newPage();
  await context.addCookies([
    {
      name: sessionA!.name,
      value: sessionA!.value,
      domain: `${storeB.slug}.localhost`,
      path: "/",
    },
  ]);
  const response = await foreignHost.goto(panelUrl(storeB.slug));
  expect(response?.status(), "la sesión de A no abre el panel de B").toBe(403);
  await foreignHost.close();

  // Sin sesión el panel tampoco renderiza datos: redirect al login.
  // `browser.newContext()` hereda el `storageState` de `test.use`, así que el
  // contexto anónimo se crea vacío de forma explícita.
  const anonymous = await context.browser()!.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(panelUrl(storeA.slug));
  await expect(anonymousPage).toHaveURL(/\/panel-admin\/login/);
  await anonymous.close();
});

test("la sesión de A no lee ni escribe productos de B", async ({ page, context }) => {
  expect(storeB.productId, "qa-store debe tener un producto de referencia").toBeTruthy();

  // Lectura: un producto de B en el panel de A. La query filtra por store_id.
  const foreignProduct = await page.goto(panelUrl(storeA.slug, `productos/${storeB.productId}`));
  expect(foreignProduct?.status(), "producto de otra tienda en el panel de A").toBe(404);

  // Escritura: POST de creación en el host de B con la sesión de A → 403.
  const cookies = await context.cookies();
  const sessionA = cookies.find((cookie) => cookie.name.includes("session_token"))!;
  const attack = await context.newPage();
  await context.addCookies([
    {
      name: sessionA.name,
      value: sessionA.value,
      domain: `${storeB.slug}.localhost`,
      path: "/",
    },
  ]);
  await attack.goto(panelUrl(storeB.slug, "login"));

  const status = await attack.evaluate(async () => {
    const body = new URLSearchParams({
      intent: "create",
      name: "Intruso",
      slug: "intruso",
      price: "1,00",
      isActive: "true",
    });
    const response = await fetch("/panel-admin/productos/nuevo", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      redirect: "manual",
    });
    return response.status;
  });
  expect(status, "escritura en la tienda B con la sesión de A").toBe(403);
  await attack.close();

  // Ni B ni A tienen ese producto.
  await page.goto(storefrontUrl(storeB.slug));
  await expect(page.locator('a[href="/producto/intruso"]')).toHaveCount(0);
  const storefrontA = await page.goto(`${storefrontUrl(storeA.slug)}/producto/intruso`);
  expect(storefrontA?.status()).not.toBe(200);
});
