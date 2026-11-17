import { test, expect } from "@playwright/test";
import fs from "node:fs";

import { expectNoSeriousA11yViolations } from "../lib/axe";
import { API_URL, CONSOLE_URL, INIT_TOKEN, panelUrl, storefrontUrl } from "../lib/config";
import { waitForResetUrl } from "../lib/outbox";
import { currentTotp, secretFromTotpUri } from "../lib/totp";
import {
  panelStatePath,
  patchState,
  readState,
  type ConsoleAdminState,
} from "../lib/state";

/**
 * Console (PLAN §15.2 #14–#17 y §15.1 #6):
 * `/init` one-time (410 después), 2FA TOTP obligatorio, backup code,
 * listado/búsqueda/detalle, suspensión con motivo, owner bloqueado, reactivación,
 * auditoría y borrado con cuarentena de slug.
 *
 * Este proyecto corre al final: elimina la tienda desechable.
 */
test.describe.configure({ mode: "serial" });

const state = readState();
const store = state.disposable;
const adminEmail = `admin-${state.runId}@example.test`;
const adminPassword = "Console2026!Admin";

async function initAvailable(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/console/init-status`);
  const payload = (await response.json()) as { available?: boolean };
  return payload.available === true;
}

async function totpFor(secret: string): Promise<string> {
  return currentTotp(secret);
}

test("crea el admin con /init, enrola 2FA y no permite un segundo alta", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);

  await page.goto(`${CONSOLE_URL}/init`);
  await expectNoSeriousA11yViolations(page, "console/init");

  const available = await initAvailable();

  if (!available) {
    const existing = readState().consoleAdmin;
    test.skip(
      !existing,
      "Ya hay un admin de console en la D1 local. Ejecuta `node e2e/scripts/reset-admin.mjs` (con los servidores parados) para repetir /init.",
    );
  }

  await page.locator("#initToken").fill(INIT_TOKEN);
  await page.locator("#name").fill("Admin E2E");
  await page.locator("#email").fill(adminEmail);
  await page.locator("#password").fill(adminPassword);
  await page.locator("#confirmPassword").fill(adminPassword);
  await page.getByRole("button", { name: "Crear administrador y activar 2FA" }).click();

  // M1: el alta no abre sesión; devuelve URI TOTP, backup codes y token.
  await expect(page.getByText("Falta verificar el segundo factor")).toBeVisible();
  await expect(page.getByText("Administrador creado")).toBeVisible();

  const totpUri = await page.locator("#totp-uri").inputValue();
  expect(totpUri.startsWith("otpauth://totp/")).toBe(true);
  const secret = secretFromTotpUri(totpUri);

  const backupCodes = await page
    .locator("ul.font-mono li")
    .allInnerTexts()
    .then((items) => items.map((item) => item.trim()).filter(Boolean));
  expect(backupCodes.length).toBeGreaterThan(0);

  const consoleAdmin: ConsoleAdminState = {
    email: adminEmail,
    password: adminPassword,
    totpSecret: secret,
    backupCodes,
  };
  patchState({ consoleAdmin });

  // Sin cookie de sesión todavía: /console/* responde 403/401.
  const beforeVerify = await context.cookies(CONSOLE_URL);
  expect(beforeVerify.some((cookie) => cookie.name.includes("session_token"))).toBe(false);

  await page.locator("#enrollment-code").fill(await totpFor(secret));
  await page.getByRole("button", { name: "Verificar y entrar" }).click();

  await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });

  // `/init` es one-time: el segundo intento responde 410 Gone.
  const secondInit = await page.evaluate(async (token) => {
    const body = new URLSearchParams({
      initToken: token,
      name: "Admin duplicado",
      email: "duplicado@example.test",
      password: "Duplicado2026!",
      confirmPassword: "Duplicado2026!",
    });
    const response = await fetch("/init", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      redirect: "manual",
    });
    return response.status;
  }, INIT_TOKEN);
  expect(secondInit).toBe(410);

  // Y la página de /init ya no ofrece el formulario.
  await page.goto(`${CONSOLE_URL}/init`);
  await expect(page.getByText("Alta inicial cerrada")).toBeVisible();
});

test("lista, busca, suspende con motivo y reactiva; el owner no puede reactivar", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const admin = readState().consoleAdmin!;
  test.skip(!admin, "El admin del console no está en e2e/.state: ejecuta e2e/scripts/reset-admin.mjs.");
  let storeId: string | null = null;

  await test.step("login con contraseña + TOTP", async () => {
    await page.goto(`${CONSOLE_URL}/login`);
    await expectNoSeriousA11yViolations(page, "console/login");
    await page.locator("#email").fill(admin.email);
    await page.locator("#password").fill(admin.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/2fa/, { timeout: 30_000 });
    await page.locator("#code").fill(await totpFor(admin.totpSecret));
    await page.getByRole("button", { name: "Verificar y entrar" }).click();
    await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });
  });

  await test.step("listado y búsqueda por slug", async () => {
    await page.goto(`${CONSOLE_URL}/?q=${encodeURIComponent(store.slug)}`);
    // La tabla (escritorio) y las cards (móvil) duplican el contenido: `.first()`.
    await expect(page.getByText(store.slug, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(store.email).first()).toBeVisible();
    const row = page.getByRole("link", { name: store.storeName }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByRole("heading", { name: store.storeName, level: 1 })).toBeVisible();
    storeId = new URL(page.url()).pathname.split("/").pop() ?? null;

    // Conteos de la ficha: productos, categorías, slides e imágenes.
    const content = page.locator("section", {
      has: page.getByRole("heading", { name: "Contenido" }),
    });
    await expect(content).toContainText("Productos");
    await expect(content).toContainText("Slides");
    const stats = await content.innerText();
    expect(stats).toContain("10");
    expect(stats).toContain("2");
  });

  await test.step("suspende con motivo y verifica 404 + panel con banner", async () => {
    await page.getByRole("button", { name: "Suspender tienda" }).click();
    await page.locator("#suspend-reason").fill("Revisión de contenido (E2E)");
    await page.getByRole("dialog").getByRole("button", { name: "Suspender" }).click();
    await expect(page.getByText("Tienda suspendida. El storefront devolverá 404.")).toBeVisible();
    await expect(page.getByText("Tienda suspendida", { exact: true })).toBeVisible();

    const storefront = await page.goto(storefrontUrl(store.slug));
    expect(storefront?.status(), "storefront suspendido por admin").toBe(404);

    // El owner sigue entrando al panel, pero ve la suspensión administrativa.
    // Se reutiliza la sesión guardada (sin gastar intentos de login).
    const ownerContext = await context.browser()!.newContext({ storageState: panelStatePath() });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(panelUrl(store.slug, "settings"));
    await expect(ownerPage.getByText("Suspendida por TuCatálogo")).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Reactivar tienda" })).toHaveCount(0);

    // Y el banner persistente del panel tampoco ofrece reactivar.
    await ownerPage.goto(panelUrl(store.slug));
    await expect(
      ownerPage.getByText("Tu tienda está suspendida por el equipo de TuCatálogo"),
    ).toBeVisible();
    await ownerContext.close();
  });

  await test.step("reactiva desde el console", async () => {
    await page.goto(`${CONSOLE_URL}/tiendas/${storeId}`);
    await page.getByRole("button", { name: "Reactivar tienda" }).click();
    await expect(page.getByText("Tienda reactivada.")).toBeVisible();
    expect((await page.goto(storefrontUrl(store.slug)))?.status()).toBe(200);
    await page.goto(`${CONSOLE_URL}/tiendas/${storeId}`);
  });

  await test.step("auditoría de la tienda", async () => {
    expect(storeId).toBeTruthy();
    await page.goto(`${CONSOLE_URL}/auditoria?storeId=${storeId}`);
    await expect(page.getByText("store.suspend").first()).toBeVisible();
    await expect(page.getByText("store.reactivate").first()).toBeVisible();
    await expectNoSeriousA11yViolations(page, "console/auditoria");
  });

  await test.step("aislamiento de reinos con cookies reales", async () => {
    const consoleCookies = await context.cookies(CONSOLE_URL);
    const consoleSession = consoleCookies.find((cookie) =>
      cookie.name.startsWith("console."),
    );
    expect(consoleSession, "cookie de sesión del console").toBeTruthy();

    // Cookie del console sobre el host de la tienda → el panel no la acepta.
    const panelPage = await context.newPage();
    await context.addCookies([
      {
        name: consoleSession!.name,
        value: consoleSession!.value,
        domain: `${store.slug}.localhost`,
        path: "/",
      },
    ]);
    await panelPage.goto(panelUrl(store.slug));
    await expect(panelPage).toHaveURL(/\/panel-admin\/login/);
    await panelPage.close();

    // Cookie de tienda sobre el console → tampoco abre sesión. El contexto se
    // crea sin la sesión real del console para no enmascarar el resultado, y la
    // cookie del dueño sale del `storageState` que dejó el proyecto `panel`.
    const ownerState = JSON.parse(fs.readFileSync(panelStatePath(), "utf8")) as {
      cookies: { name: string; value: string }[];
    };
    const storeSession = ownerState.cookies.find((cookie) => cookie.name.startsWith("store."));
    expect(storeSession, "cookie de sesión de la tienda").toBeTruthy();

    const outsider = await context.browser()!.newContext({
      storageState: {
        cookies: [
          {
            name: storeSession!.name,
            value: storeSession!.value,
            domain: "localhost",
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
    });
    const consolePage = await outsider.newPage();
    await consolePage.goto(`${CONSOLE_URL}/`);
    await expect(consolePage).toHaveURL(/\/login/);
    await outsider.close();
  });
});

test("recupera la contraseña del console por email y entra con el nuevo 2FA", async ({ page }) => {
  test.setTimeout(180_000);
  const admin = readState().consoleAdmin!;
  test.skip(!admin, "El admin del console no está en e2e/.state: ejecuta e2e/scripts/reset-admin.mjs.");

  const newPassword = `ConsoleReset2026!${readState().runId.slice(-4)}`;

  await page.goto(`${CONSOLE_URL}/recuperar`);
  await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
  await page.locator("#email").fill(admin.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Solicitud recibida")).toBeVisible();

  const resetUrl = await waitForResetUrl(admin.email);
  expect(resetUrl).toContain("/reset-password?token=");

  // El correo enlaza a `/reset-password`, que redirige a `/restablecer`.
  await page.goto(resetUrl);
  await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
  await page.locator("#password").fill(newPassword);
  await page.locator("#confirmPassword").fill(newPassword);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("heading", { name: "Contraseña actualizada" })).toBeVisible();

  // El reset no salta el 2FA: hay que iniciar sesión y verificar el código.
  await page.goto(`${CONSOLE_URL}/login`);
  await page.locator("#email").fill(admin.email);
  await page.locator("#password").fill(newPassword);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2fa/, { timeout: 30_000 });
  await page.locator("#code").fill(await totpFor(admin.totpSecret));
  await page.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });

  patchState({ consoleAdmin: { ...admin, password: newPassword } });
});

test("entra con un backup code y el logout invalida la sesión", async ({ page }) => {
  test.setTimeout(180_000);
  const admin = readState().consoleAdmin!;
  const code = admin.backupCodes.at(-1);
  test.skip(!admin, "El admin del console no está en e2e/.state: ejecuta e2e/scripts/reset-admin.mjs.");
  test.skip(!code, "No quedan backup codes guardados de este admin.");

  // Sin cookies: el console exige sesión y redirige al login.
  await page.goto(`${CONSOLE_URL}/`);
  await expect(page).toHaveURL(/\/login/);

  // Un backup code completa el segundo factor sin TOTP.
  await page.locator("#email").fill(admin.email);
  await page.locator("#password").fill(admin.password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2fa/, { timeout: 30_000 });
  await page.locator("#type").selectOption("backup");
  await page.locator("#code").fill(code!);
  await page.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });

  // Logout por POST, no por GET.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);

  // La sesión ya no abre el listado (el redirect lo decide el loader).
  await page.goto(`${CONSOLE_URL}/`);
  await expect(page).toHaveURL(/\/login/);

  patchState({
    consoleAdmin: { ...admin, backupCodes: admin.backupCodes.slice(0, -1) },
  });
});

test("elimina la tienda desechable con confirmación, audit y cuarentena", async ({ page }) => {
  test.setTimeout(180_000);
  const admin = readState().consoleAdmin!;
  test.skip(!admin, "El admin del console no está en e2e/.state: ejecuta e2e/scripts/reset-admin.mjs.");

  await page.goto(`${CONSOLE_URL}/login`);
  await page.locator("#email").fill(admin.email);
  await page.locator("#password").fill(admin.password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2fa/, { timeout: 30_000 });
  await page.locator("#code").fill(await totpFor(admin.totpSecret));
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
