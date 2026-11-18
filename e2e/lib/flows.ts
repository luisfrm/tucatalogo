import { expect, type Page } from "@playwright/test";

import { COMMERCIAL_URL, panelUrl, storefrontUrl } from "./config";
import { waitForSignupCode } from "./outbox";
import { panelStatePath } from "./state";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  storeName: string;
  slug: string;
  currency?: "USD" | "EUR" | "COP" | "VES" | "ARS";
  themeId?: string;
}

export interface RegisterResult {
  storefront: string;
  panel: string;
}

/**
 * Registro real por UI en commercial (PLAN §4.5 A): datos → slug check en vivo →
 * tema → OTP leído del outbox local → confirmación con enlaces.
 *
 * Turnstile: en local el worker usa `TURNSTILE_MODE=test` y el sitekey de prueba
 * oficial, que devuelve un token sin interacción. No hay ningún bypass: si el
 * widget no entrega token, el botón sigue deshabilitado y el test falla.
 */
export async function registerStore(page: Page, input: RegisterInput): Promise<RegisterResult> {
  const currency = input.currency ?? "USD";
  const themeId = input.themeId ?? "rose";

  await page.goto(`${COMMERCIAL_URL}/registro`);
  await expect(page.getByRole("heading", { name: "Crea tu catálogo", level: 1 })).toBeVisible();

  // Paso 1 — datos del dueño + tienda + moneda + términos.
  await page.locator("#signup-name").fill(input.name);
  await page.locator("#signup-email").fill(input.email);
  await page.locator("#signup-password").fill(input.password);
  await page.locator("#signup-password-confirm").fill(input.password);
  await page.locator("#signup-store-name").fill(input.storeName);
  await page.locator("#signup-slug").fill(input.slug);
  await page.locator("#signup-currency").selectOption(currency);
  await page.locator("#signup-terms").check();

  // Slug check en vivo (debounce 300 ms contra /registro/slug-check).
  await expect(page.locator('p[aria-live="polite"]').first()).toContainText("Disponible", {
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elige el tema" })).toBeVisible();

  // Paso 2 — tema (radio real, oculto a la vista pero accionable).
  await page.locator(`input[name="themeId"][value="${themeId}"]`).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();

  // Paso 3 — Turnstile + envío del OTP.
  const sendButton = page.getByRole("button", { name: "Enviar código" });
  await expect(
    sendButton,
    "Turnstile no entregó token: el widget de prueba no cargó y el registro no puede continuar sin él",
  ).toBeEnabled({ timeout: 45_000 });
  await sendButton.click();

  await expect(page.locator("#signup-code")).toBeVisible({ timeout: 30_000 });
  const code = await waitForSignupCode(input.email);
  await page.locator("#signup-code").fill(code);
  await page.getByRole("button", { name: "Verificar y crear mi tienda" }).click();

  // Paso 4 — confirmación con los enlaces de tienda y panel.
  // `exact: true`: el paso 1 también dice "…y tu tienda publicada".
  await expect(page.getByText("Tienda publicada", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`${input.storeName} ya tiene su catálogo`)).toBeVisible();

  const storefrontLink = await page
    .locator(`a[href^="${storefrontUrl(input.slug)}"]`)
    .first()
    .getAttribute("href");
  const panelLink = await page
    .locator(`a[href*="/panel-admin"]`)
    .first()
    .getAttribute("href");

  return {
    storefront: storefrontLink ?? storefrontUrl(input.slug),
    panel: panelLink ?? panelUrl(input.slug, "login"),
  };
}

/** Devuelve true si el storefront responde 200 (la tienda existe y está activa). */
export async function storeExists(page: Page, slug: string): Promise<boolean> {
  // Navegación real: Chromium resuelve `*.localhost` a loopback; la petición de
  // Node del APIRequestContext no (getaddrinfo ENOTFOUND).
  const response = await page.goto(storefrontUrl(slug));
  return response?.status() === 200;
}

export async function loginPanel(
  page: Page,
  slug: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(panelUrl(slug, "login"));
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(new RegExp(`${slug}\\.localhost:5173/panel-admin/?$`), {
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: /Productos/ }).first()).toBeVisible();
}

export async function logoutPanel(page: Page, slug: string): Promise<void> {
  await page.goto(panelUrl(slug, "logout"));
  await expect(page).toHaveURL(new RegExp(`${slug}\\.localhost:5173/panel-admin/login`));
}

/** Guarda la sesión del panel para reutilizarla sin volver a autenticarse. */
export async function savePanelSession(page: Page): Promise<void> {
  await page.context().storageState({ path: panelStatePath() });
}
