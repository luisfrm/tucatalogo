import { test, expect } from "@playwright/test";

import { COMMERCIAL_URL, QA_STORE, storefrontUrl } from "../lib/config";
import { readState } from "../lib/state";

/**
 * Storefront público (PLAN §15.1 #2, #4, #6, #12):
 * home con hero y grilla, ficha con precio/WhatsApp, modo oscuro por cookie,
 * SEO y 404 idéntico para slug inexistente, reservado o suspendido.
 */
const state = readState();
const store = state.disposable;

test("publica el catálogo de la tienda", async ({ page }) => {
  const base = storefrontUrl(store.slug);

  await test.step("home 200 con tema, hero y grilla", async () => {
    const response = await page.goto(base);
    expect(response?.status()).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("data-theme", store.themeId ?? "nude-studio");
    await expect(page.getByRole("heading", { name: store.storeName, level: 1 })).toBeVisible();
    await expect(page.getByText("10 productos en el catálogo")).toBeVisible();
    await expect(page.getByRole("region", { name: "Destacados de la tienda" })).toBeVisible();

    const productLinks = page.locator('a[href^="/producto/"]');
    expect(await productLinks.count()).toBe(10);

    // El CSS del tema viaja en el <head> (sin FOUC).
    const tokens = await page.locator("style[data-theme-tokens]").innerHTML();
    expect(tokens).toContain("--color-bg");
    expect(tokens).toContain("--color-primary");
  });

  await test.step("ficha de producto con precio en la moneda de la tienda y WhatsApp", async () => {
    const response = await page.goto(`${base}/producto/producto-e2e-1`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Producto E2E 1", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText(/COP/).first()).toBeVisible();

    const gallery = page.locator('img[src*="/media/stores/"]');
    expect(await gallery.count()).toBeGreaterThan(0);

    const whatsapp = page.getByRole("link", { name: "Pedir por WhatsApp" });
    await expect(whatsapp).toBeVisible();
    const href = (await whatsapp.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/584141234567?text=")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Producto E2E 1");
    expect(decoded).toContain(store.storeName);
  });

  await test.step("modo oscuro por cookie (SSR, sin parpadeo)", async () => {
    await page.goto(base);
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");

    await page.getByRole("button", { name: "Activar modo oscuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
    const darkTokens = await page.locator("style[data-theme-tokens]").textContent();
    expect(darkTokens).toContain('[data-color-mode="dark"]');
    expect(darkTokens).toContain("--color-bg");

    await page.getByRole("button", { name: "Activar modo claro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  });

  await test.step("SEO: sitemap y robots", async () => {
    await page.goto(`${base}/sitemap.xml`);
    const sitemap = await page.locator("body").innerText();
    expect(sitemap).toContain("producto-e2e-1");
    expect(sitemap).toContain(store.slug);

    const robots = await page.goto(`${base}/robots.txt`);
    expect(robots?.status()).toBe(200);
    const robotsBody = await page.locator("body").innerText();
    // En local la tienda lleva `Disallow: /`; en producción publica el sitemap.
    expect(robotsBody).toContain("User-agent: *");
    expect(robotsBody).toContain("Disallow: /");
  });
});

test("slug inexistente, reservado o producto inexistente devuelven 404 controlado", async ({
  page,
}) => {
  const unknown = await page.goto(storefrontUrl("no-existe-e2e"));
  expect(unknown?.status()).toBe(404);
  await expect(page.getByText(/no encontramos|no existe|404/i).first()).toBeVisible();

  for (const reserved of ["admin", "console", "tucatalogo", "api"]) {
    const response = await page.goto(storefrontUrl(reserved));
    expect(response?.status(), `slug reservado ${reserved}`).toBe(404);
  }

  const missingProduct = await page.goto(`${storefrontUrl(store.slug)}/producto/no-existe`);
  expect(missingProduct?.status()).toBe(404);

  // El formulario de registro responde con un motivo tipado, nunca 500.
  const slugCheck = await page.goto(`${COMMERCIAL_URL}/registro/slug-check?slug=admin`);
  expect(slugCheck?.status()).toBe(200);
  const payload = JSON.parse(await page.locator("body").innerText());
  expect(payload.available).toBe(false);
  expect(payload.reason).toBeTruthy();
});

test("la tienda de referencia qa-store sigue intacta y accesible", async ({ page }) => {
  const response = await page.goto(storefrontUrl(QA_STORE.slug));
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: QA_STORE.storeName, level: 1 })).toBeVisible();
});
