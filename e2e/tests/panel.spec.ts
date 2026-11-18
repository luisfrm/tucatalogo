import { test, expect } from "@playwright/test";

import { panelUrl, storefrontUrl } from "../lib/config";
import { loginPanel, logoutPanel, savePanelSession } from "../lib/flows";
import { heroFixtures, productFixture } from "../lib/media";
import { waitForResetUrl } from "../lib/outbox";
import { patchState, readState } from "../lib/state";

/**
 * Panel del dueño (PLAN §15.1 #2, #3, #5, #6 y §15.2):
 * login, categoría, 10 productos con imágenes, hero con 2 slides
 * (escritorio + móvil), tema/color/moneda/WhatsApp, suspensión del owner y
 * recuperación de contraseña.
 *
 * **Sin `mode: "serial"` ni aserciones de axe**: este proyecto es dependencia de
 * `storefront`, `axe` y `console`, así que nada de lo que pase aquí puede
 * saltarse proyectos enteros. Las auditorías de accesibilidad del panel viven en
 * `axe.spec.ts` (proyecto del que nadie depende) y aquí solo queda el flujo.
 */
const PRODUCT_COUNT = 10;

test("publica el catálogo completo desde el panel", async ({ page }) => {
  test.setTimeout(300_000);
  const state = readState();
  const store = state.disposable;
  const base = storefrontUrl(store.slug);

  await test.step("login del dueño", async () => {
    await loginPanel(page, store.slug, store.email, store.password);
    await savePanelSession(page);
    await expect(page.getByText(`panel-admin · ${store.slug}`).or(page.getByText(store.slug)).first()).toBeVisible();
  });

  await test.step("crea una categoría", async () => {
    await page.goto(panelUrl(store.slug, "categorias"));
    await page.locator("#category-name").fill("Sandalias");
    await page.locator("#category-slug").fill("sandalias");
    await page.getByRole("button", { name: "Crear categoría" }).click();
    await expect(page.getByText("Categoría creada.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Sandalias" })).toBeVisible();
    patchState({ disposable: { ...store, categorySlug: "sandalias" } });
  });

  await test.step(`crea ${PRODUCT_COUNT} productos con el formulario`, async () => {
    const productIds: string[] = [];

    for (let index = 1; index <= PRODUCT_COUNT; index += 1) {
      const name = `Producto E2E ${index}`;
      const slug = `producto-e2e-${index}`;

      await page.goto(panelUrl(store.slug, "productos/nuevo"));
      await page.locator('form input[name="name"]').first().fill(name);
      await page.locator('form input[name="slug"]').first().fill(slug);
      await page.locator('form input[name="price"]').first().fill("49,90");
      await page.locator('select[name="categoryId"]').first().selectOption({ label: "Sandalias" });
      await page
        .locator('form textarea[name="description"]')
        .first()
        .fill(`Descripción de ${name}. Producto creado por el E2E del MVP.`);
      await page.getByRole("button", { name: "Crear producto" }).click();

      await expect(page).toHaveURL(/\/panel-admin\/productos\/(?!nuevo$)[^/?]+(\?|$)/, {
        timeout: 30_000,
      });
      await expect(page.getByText("Producto creado. Ahora puedes añadir imágenes.")).toBeVisible();
      const id = new URL(page.url()).pathname.split("/").pop()!;
      productIds.push(id);

      if (index === 1) {
        patchState({
          disposable: { ...readState().disposable, productId: id, productSlug: slug, productIds },
        });
      }
    }

    patchState({ disposable: { ...readState().disposable, productIds } });

    await page.goto(panelUrl(store.slug, "productos"));
    await expect(page.getByText(`${PRODUCT_COUNT} productos`, { exact: false }).first()).toBeVisible();
    expect(productIds).toHaveLength(PRODUCT_COUNT);
  });

  await test.step("sube imágenes reales (normalizadas a WebP en el navegador)", async () => {
    const first = readState().disposable;
    await page.goto(panelUrl(store.slug, `productos/${first.productId}`));
    await expect(page.getByRole("heading", { name: "Producto E2E 1", level: 1, exact: true })).toBeVisible();

    for (let index = 1; index <= 2; index += 1) {
      const fixture = await productFixture(page, `sandalias-${index}`);
      await page.locator("#product-image-file").setInputFiles(fixture);
      await page.locator("#product-image-alt").fill(`Sandalias de prueba ${index}`);
      await page.getByRole("button", { name: "Subir imagen", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Imagen añadida" })).toBeVisible({
        timeout: 60_000,
      });
    }

    await expect(page.getByText(/2 de 8 imágenes/).first()).toBeVisible();
    const mediaSrc = await page.locator('img[src*="/media/stores/"]').first().getAttribute("src");
    expect(mediaSrc, "la imagen servida debe salir de MEDIA_BASE_URL").toBeTruthy();

    // La ruta dev-only `/media/*` sirve el objeto real de R2 (WebP).
    const mediaResponse = await page.request.get(mediaSrc!);
    expect(mediaResponse.status()).toBe(200);
    expect(mediaResponse.headers()["content-type"]).toContain("image/webp");

    // Un segundo producto con una imagen para comprobar la grilla pública.
    await page.goto(panelUrl(store.slug, `productos/${first.productIds![1]}`));
    const secondFixture = await productFixture(page, "producto-2");
    await page.locator("#product-image-file").setInputFiles(secondFixture);
    await page.locator("#product-image-alt").fill("Producto dos");
    await page.getByRole("button", { name: "Subir imagen", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Imagen añadida" })).toBeVisible({
      timeout: 60_000,
    });
  });

  await test.step("crea 2 slides de hero (escritorio + móvil)", async () => {
    await page.goto(panelUrl(store.slug, "hero"));
    await expect(page.getByRole("heading", { name: "Hero" })).toBeVisible();

    for (const index of [1, 2]) {
      const [desktop, mobile] = await heroFixtures(page, `hero-${index}`);
      await page.locator("#hero-desktop").setInputFiles(desktop);
      await page.locator("#hero-mobile").setInputFiles(mobile);
      await page.locator("#hero-title").fill(`Colección E2E ${index}`);
      await page.locator("#hero-subtitle").fill("Sandalias hechas a mano");
      await page.getByRole("button", { name: "Añadir slide" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Slide añadido" })).toBeVisible({
        timeout: 60_000,
      });
    }

    await expect(page.getByText(/2 de 10 slides|2 slides/).first()).toBeVisible();
  });

  await test.step("el storefront publica hero, productos e imágenes", async () => {
    await page.goto(base);
    const hero = page.getByRole("region", { name: "Destacados de la tienda" });
    await expect(hero).toBeVisible();
    await expect(page.getByRole("group", { name: "1 de 2" })).toBeVisible();
    // Solo el slide activo está en el árbol de accesibilidad; los controles
    // confirman que existen las dos diapositivas.
    await expect(page.getByRole("button", { name: "Ir a la diapositiva 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ir a la diapositiva 2" })).toBeVisible();
    await expect(hero.locator("img")).toHaveCount(2);

    await page.getByRole("button", { name: "Ir a la diapositiva 2" }).click();
    await expect(page.getByRole("heading", { name: "Colección E2E 2" })).toBeVisible();

    await expect(page.getByRole("heading", { name: store.storeName })).toBeVisible();
    await expect(page.getByText(`${PRODUCT_COUNT} productos en el catálogo`)).toBeVisible();
    const card = page.locator('a[href="/producto/producto-e2e-1"]').first();
    await expect(card.locator("img")).toBeVisible();

    // Ficha de producto con precio formateado y sin WhatsApp todavía.
    await page.locator('a[href="/producto/producto-e2e-1"]').first().click();
    await expect(page.getByRole("heading", { name: "Producto E2E 1", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText(/49,90/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir por WhatsApp" })).toHaveCount(0);

    // SEO: sitemap y robots responden (navegación real: `page.request` no
    // resuelve `*.localhost` en Node).
    const sitemap = await page.goto(`${base}/sitemap.xml`);
    expect(sitemap?.status()).toBe(200);
    expect(await page.content()).toContain("producto-e2e-1");
  });

  await test.step("cambia tema, color, moneda y WhatsApp y lo verifica en la tienda", async () => {
    await page.goto(panelUrl(store.slug, "settings"));

    await page.locator('input[name="themeId"][value="nude-studio"]').check({ force: true });
    await page.locator('input[name="primaryColor"]').fill("#2F6F4F");
    await page.locator('select[name="currency"]').selectOption("COP");
    await page.locator('input[name="whatsappNumber"]').fill("584141234567");
    await page
      .locator('textarea[name="whatsappMessageTemplate"]')
      .fill("Hola {tienda}, quiero {producto} por {precio}.");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Datos de la tienda guardados.")).toBeVisible();

    patchState({
      disposable: {
        ...readState().disposable,
        themeId: "nude-studio",
        primaryColor: "#2F6F4F",
      },
    });

    await page.goto(base);
    // El injector SSR deja el tema en el HTML inicial (sin FOUC).
    await expect(page.locator("html")).toHaveAttribute("data-theme", "nude-studio");
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
    const tokens = await page.locator("style[data-theme-tokens]").innerHTML();
    expect(tokens).toContain("--color-primary");

    await page.goto(`${base}/producto/producto-e2e-1`);
    await expect(page.getByText(/COP/).first()).toBeVisible();
    const whatsapp = page.getByRole("link", { name: "Pedir por WhatsApp" });
    await expect(whatsapp).toBeVisible();
    const href = await whatsapp.getAttribute("href");
    expect(href).toContain("https://wa.me/584141234567");
    expect(decodeURIComponent(href!)).toContain("Producto E2E 1");
    expect(decodeURIComponent(href!)).toContain("Tienda E2E");
  });

  await test.step("suspensión del owner: 404 público y panel accesible con banner", async () => {
    await page.goto(panelUrl(store.slug, "settings"));
    await page.getByText("Suspender la tienda", { exact: true }).first().click();
    await page.locator("#suspend-reason").fill("Prueba E2E de suspensión del dueño");
    await page.getByLabel(/Entiendo que la tienda dejará de ser pública/).check();
    await page.getByRole("button", { name: "Suspender tienda" }).click();
    await expect(page.getByText(/La tienda quedó suspendida/)).toBeVisible();

    const storefront = await page.goto(base);
    expect(storefront?.status(), "storefront suspendido").toBe(404);

    const panel = await page.goto(panelUrl(store.slug));
    expect(panel?.status(), "el panel sigue accesible con la tienda suspendida").toBe(200);
    await expect(
      page.getByText("Tu tienda está suspendida", { exact: false }).first(),
    ).toBeVisible();

    await page.goto(panelUrl(store.slug, "settings"));
    await page.getByRole("button", { name: "Reactivar tienda" }).click();
    await expect(page.getByText(/La tienda volvió a estar activa/)).toBeVisible();
    expect((await page.goto(base))?.status()).toBe(200);
  });
});

test("recupera la contraseña de extremo a extremo", async ({ page }) => {
  test.setTimeout(180_000);
  const state = readState();
  const store = state.disposable;
  const newPassword = store.passwordAfterReset!;

  await logoutPanel(page, store.slug);

  await page.goto(panelUrl(store.slug, "login"));
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await page.locator("#forgot-email").fill(store.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();

  const resetUrl = await waitForResetUrl(store.email);
  expect(resetUrl).toContain("/panel-admin/reset-password?token=");

  await page.goto(resetUrl);
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  await page.locator("#reset-password").fill(newPassword);
  await page.locator("#reset-password-confirmation").fill(newPassword);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();

  await expect(page).toHaveURL(/\/panel-admin\/login\?ok=password-reset/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Entra a tu tienda" })).toBeVisible();

  // La contraseña antigua ya no sirve y la nueva sí.
  await page.locator("#login-email").fill(store.email);
  await page.locator("#login-password").fill(store.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();

  await page.locator("#login-password").fill(newPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(new RegExp(`${store.slug}\\.localhost:5173/panel-admin/?$`), {
    timeout: 30_000,
  });
  await savePanelSession(page);

  patchState({ disposable: { ...readState().disposable, password: newPassword } });
});
