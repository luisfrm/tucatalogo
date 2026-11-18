import { test, expect } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "../lib/axe";
import {
  COMMERCIAL_URL,
  CONSOLE_URL,
  QA_STORE,
  panelUrl,
  runId,
  storefrontUrl,
} from "../lib/config";
import { loginPanel, registerStore } from "../lib/flows";
import { panelStatePath, readState } from "../lib/state";

/**
 * axe (PLAN §14 y §15.1 #11, mitad de accesibilidad):
 * home y ficha del storefront, login del panel, login/init del console y las
 * **dos superficies rediseñadas** (landing + registro de commercial y shell del
 * console), siempre a 1280 y 390 px.
 *
 * Se ejecuta sobre la tienda desechable (ya publicada) y sobre `qa-store`, que
 * es la tienda de referencia que no se borra. El listado, la ficha, la
 * auditoría y los estados vacío/error del console se auditan en
 * `console.spec.ts`, cuando existe sesión verificada.
 */
const state = readState();
const store = state.disposable;

/** Anchos del contrato responsive (PLAN §10.4): escritorio y móvil. */
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

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

test("axe: login del panel y login/init del console", async ({ page }) => {
  await page.goto(panelUrl(store.slug, "login"));
  await expect(page.getByRole("heading", { name: "Entra a tu tienda" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "panel-admin/login");
  await page.goto(`${CONSOLE_URL}/login`);
  await expect(page.getByRole("heading", { name: "Acceso al console" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "console/login");

  await page.goto(`${CONSOLE_URL}/init`);
  await expectNoSeriousA11yViolations(page, "console/init");

  // Los dos formularios de acceso, también a 390 px (móvil).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${CONSOLE_URL}/login`);
  await expect(page.getByRole("heading", { name: "Acceso al console" })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "console/login-390");

  await page.goto(`${CONSOLE_URL}/init`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, "console/init-390");
});

/**
 * Panel autenticado (PLAN §15.1 #11): el listado de productos es la pantalla más
 * densa del panel. Se audita aquí, con la sesión que dejó el proyecto `panel` en
 * `e2e/.state/panel.json`, para que una violación de accesibilidad no tumbe el
 * flujo funcional de `panel` (del que dependen los demás proyectos).
 */
test.describe("panel autenticado", () => {
  test.use({ storageState: panelStatePath() });

  test("axe: productos del panel (1280 y 390)", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const response = await page.goto(panelUrl(store.slug, "productos"));
      expect(response?.status(), "listado de productos del panel").toBe(200);
      await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
      await expectNoSeriousA11yViolations(page, `panel-admin/productos-${viewport.width}`);
    }
  });
});

/**
 * Landing rediseñada: la sección `#temas` pinta los tokens reales de cada tema,
 * así que se audita **también** con `/theme-fonts.css` ya cargado (el estado en
 * el que el usuario la ve) y con una pregunta del FAQ desplegada.
 */
test("axe: landing de commercial (1280 y 390)", async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const response = await page.goto(`${COMMERCIAL_URL}/`, { waitUntil: "load" });
    expect(response?.status(), "landing de commercial").toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expectNoSeriousA11yViolations(page, `commercial/home-${viewport.width}`);

    // Estado final: previews con la tipografía real de cada tema.
    await page.locator("#temas").scrollIntoViewIfNeeded();
    await expect(page.locator("link[data-theme-fonts]")).toHaveCount(1);
    await expect
      .poll(
        () => page.evaluate(() => document.fonts.check('16px "Cormorant Garamond"')),
        { message: "las fuentes de los temas deben estar disponibles en #temas" },
      )
      .toBe(true);

    // FAQ desplegada: el `summary` con chevron propio es contenido interactivo.
    const firstFaq = page.locator("#preguntas details").first();
    await firstFaq.locator("summary").click();
    await expect(firstFaq).toHaveJSProperty("open", true);

    await expectNoSeriousA11yViolations(page, `commercial/home-${viewport.width}-final`);
  }
});

/**
 * Registro de 4 pasos, pasos 1–3. El paso 2 monta `ThemeFontLoader` y cambia
 * el árbol de campos (radios dentro de `<label>`), así que se audita el DOM
 * real de cada paso, no el del primer render.
 */
test("axe: registro de commercial en los pasos 1 a 3 (1280 y 390)", async ({ page }) => {
  const id = runId();
  const slug = `e2e-axe-${id}`;

  await page.setViewportSize(VIEWPORTS[0]);
  const response = await page.goto(`${COMMERCIAL_URL}/registro`);
  expect(response?.status(), "formulario de registro").toBe(200);
  await expect(page.getByRole("heading", { name: "Crea tu catálogo", level: 1 })).toBeVisible();

  await test.step("paso 1: datos del dueño y de la tienda", async () => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expectNoSeriousA11yViolations(page, `commercial/registro-paso1-${viewport.width}`);
    }

    await page.setViewportSize(VIEWPORTS[0]);
    await page.locator("#signup-name").fill("Dueña Axe");
    await page.locator("#signup-email").fill(`axe-${id}@example.test`);
    await page.locator("#signup-password").fill("AxeStore2026!");
    await page.locator("#signup-password-confirm").fill("AxeStore2026!");
    await page.locator("#signup-store-name").fill(`Tienda Axe ${id}`);
    await page.locator("#signup-slug").fill(slug);
    await page.locator("#signup-currency").selectOption("EUR");
    await page.locator("#signup-terms").check();

    // Sin esperas fijas: el debounce del slug termina en respuesta del resource route.
    await expect(page.locator('p[aria-live="polite"]').first()).toContainText("Disponible", {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Continuar" }).click();
  });

  await test.step("paso 2: selector de tema con previews reales", async () => {
    await expect(page.getByRole("heading", { name: "Elige el tema" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('16px "Cormorant Garamond"')), {
        message: "el paso 2 debe cargar las fuentes de los temas",
      })
      .toBe(true);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expectNoSeriousA11yViolations(page, `commercial/registro-paso2-${viewport.width}`);
    }

    await page.setViewportSize(VIEWPORTS[0]);
    await page.locator('input[name="themeId"][value="rose"]').check({ force: true });
    await page.getByRole("button", { name: "Continuar" }).click();
  });

  await test.step("paso 3: verificación por correo", async () => {
    await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
    // El campo del código aparece tras enviar el OTP; aquí se audita el paso en
    // su estado real: Turnstile listo y el botón de envío habilitado.
    await expect(
      page.getByRole("button", { name: "Enviar código" }),
      "Turnstile debe entregar token para que el paso 3 esté en su estado final",
    ).toBeEnabled({ timeout: 45_000 });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expectNoSeriousA11yViolations(page, `commercial/registro-paso3-${viewport.width}`);
    }
  });
});

/**
 * Paso 4 ("Tienda publicada") solo existe tras un alta real, así que este test
 * crea su propia tienda `e2e-axe-*` y la **borra** al terminar por el camino del
 * dueño (hard delete + cuarentena), igual que haría una persona: ni D1 ni R2
 * acumulan tiendas de auditoría entre ejecuciones.
 */
test("axe: registro paso 4 con alta real y limpieza", async ({ page }) => {
  test.setTimeout(240_000);

  const id = runId();
  const slug = `e2e-axe-${id}`;
  const email = `axe-${id}@example.test`;
  const password = "AxeStore2026!";

  await page.setViewportSize(VIEWPORTS[0]);
  await registerStore(page, {
    name: "Dueña Axe",
    email,
    password,
    storeName: `Tienda Axe ${id}`,
    slug,
    currency: "EUR",
    themeId: "rose",
  });
  await expect(page.getByText("Tienda publicada", { exact: true })).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expectNoSeriousA11yViolations(page, `commercial/registro-paso4-${viewport.width}`);
  }

  await page.setViewportSize(VIEWPORTS[0]);
  await loginPanel(page, slug, email, password);
  await page.goto(panelUrl(slug, "settings"));
  await page.getByText("Quiero eliminar mi tienda", { exact: true }).click();
  await page.locator("#delete-password").fill(password);
  await page.locator("#delete-slug").fill(slug);
  await page.getByLabel(/Entiendo que esta acción es permanente/).check();
  await page.getByRole("button", { name: "Eliminar tienda definitivamente" }).click();
  await expect(page).toHaveURL(/\/panel-admin\/eliminada/, { timeout: 30_000 });
});
