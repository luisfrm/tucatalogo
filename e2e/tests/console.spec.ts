import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

import { expectNoSeriousA11yViolations } from "../lib/axe";
import { API_URL, CONSOLE_URL, INIT_TOKEN, panelUrl, storefrontUrl } from "../lib/config";
import { waitForResetUrl } from "../lib/outbox";
import { currentTotp, secretFromTotpUri } from "../lib/totp";
import {
  panelStatePath,
  patchState,
  readConsoleAdmin,
  readState,
  type ConsoleAdminState,
} from "../lib/state";

/**
 * Console (PLAN §15.2 #14–#17 y §15.1 #6):
 * `/init` one-time (410 después), 2FA TOTP obligatorio, backup code,
 * listado/búsqueda/detalle, suspensión con motivo, owner bloqueado, reactivación,
 * aislamiento de reinos y auditoría.
 *
 * Deliberadamente **sin `mode: "serial"`**: los tests comparten estado por
 * `e2e/.state` (un solo worker y orden de declaración), pero un fallo —por
 * ejemplo una violación de axe— ya no salta los tests siguientes. Cada test
 * declara su precondición y se salta con motivo si no la tiene. El borrado de la
 * tienda desechable vive en `console-delete.spec.ts`, que sí depende de todo lo
 * demás porque deja el estado final.
 */

const state = readState();
const store = state.disposable;
const adminEmail = `admin-${state.runId}@example.test`;
const adminPassword = "Console2026!Admin";

async function initAvailable(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/console/init-status`);
  const payload = (await response.json()) as { available?: boolean };
  return payload.available === true;
}

/**
 * `POST /init` desde la propia página del console, sin seguir el redirect.
 * El API comprueba primero si ya hay admin, así que con el alta consumida el
 * status es 410 aunque el token sea válido.
 */
async function secondInitStatus(page: Page): Promise<number> {
  return page.evaluate(async (token) => {
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
}

async function totpFor(secret: string): Promise<string> {
  return currentTotp(secret);
}

test("crea el admin con /init, enrola 2FA y no permite un segundo alta", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);

  const available = await initAvailable();

  if (!available) {
    // `/init` ya está consumida: crear otro admin es imposible por contrato, así
    // que no tiene sentido rellenar el formulario (el action respondería 410).
    // Se comprueba el lado cerrado del contrato y se reutiliza el admin de la
    // pasada anterior, que vive en `e2e/.state/console-admin.json` y sobrevive a
    // la reescritura de `run.json` que hace `setup`. Nada de limpiar la D1 a mano.
    await page.goto(`${CONSOLE_URL}/init`);
    await expect(
      page.getByRole("heading", { name: "Alta inicial cerrada" }),
      "con un admin en la D1 local, /init no debe ofrecer el formulario",
    ).toBeVisible();
    expect(await secondInitStatus(page), "segundo /init debe responder 410").toBe(410);

    const persisted = readConsoleAdmin();
    if (!persisted) {
      test.skip(
        true,
        "La D1 local ya tiene un admin de console y no hay credenciales de una pasada anterior en e2e/.state/console-admin.json. Ese admin se creó fuera del E2E: con los servidores parados, `node e2e/scripts/reset-admin.mjs` habilita un alta nueva; no hace falta repetirlo en pasadas posteriores.",
      );
      return;
    }

    test.info().annotations.push({
      type: "console-admin",
      description: `reutilizado de una pasada anterior: ${persisted.email}`,
    });
    patchState({ consoleAdmin: persisted });
    return;
  }

  await page.goto(`${CONSOLE_URL}/init`);
  await expectNoSeriousA11yViolations(page, "console/init");

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
  // `patchState` lo replica en `console-admin.json` para las próximas pasadas.
  patchState({ consoleAdmin });

  // Sin cookie de sesión todavía: /console/* responde 403/401.
  const beforeVerify = await context.cookies(CONSOLE_URL);
  expect(beforeVerify.some((cookie) => cookie.name.includes("session_token"))).toBe(false);

  await page.locator("#enrollment-code").fill(await totpFor(secret));
  await page.getByRole("button", { name: "Verificar y entrar" }).click();

  await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible({ timeout: 30_000 });

  // `/init` es one-time: el segundo intento responde 410 Gone.
  expect(await secondInitStatus(page)).toBe(410);

  // Y la página de /init ya no ofrece el formulario.
  await page.goto(`${CONSOLE_URL}/init`);
  await expect(page.getByText("Alta inicial cerrada")).toBeVisible();
});

test("lista, busca, suspende con motivo y reactiva; el owner no puede reactivar", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const admin = readState().consoleAdmin;
  test.skip(!admin, "El alta del console no corrió en esta pasada: no hay admin que reutilizar.");
  if (!admin) return;
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

    // axe del shell rediseñado: listado, ficha, vacío y error a 1280 y 390.
    // `expect.soft`: si una superficie falla, las demás se auditan igual y el
    // test no corta el flujo antes de suspender/reactivar.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${CONSOLE_URL}/`);
    await expect(page.getByRole("heading", { name: "Tiendas" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "console/tiendas-1280");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSeriousA11yViolations(page, "console/tiendas-390");

    // Estado vacío: la búsqueda no coincide con ninguna tienda.
    await page.goto(`${CONSOLE_URL}/?q=zzz-sin-coincidencias-e2e`);
    await expect(page.getByText("Ninguna tienda coincide")).toBeVisible();
    await expectNoSeriousA11yViolations(page, "console/vacio-390");

    await page.setViewportSize({ width: 1280, height: 900 });
    await expectNoSeriousA11yViolations(page, "console/vacio-1280");

    // Estado de error: ficha de una tienda que no existe (404 del api).
    const missing = await page.goto(
      `${CONSOLE_URL}/tiendas/00000000-0000-4000-8000-000000000000`,
    );
    expect(missing?.status(), "ficha inexistente").toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esa tienda" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "console/error-1280");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSeriousA11yViolations(page, "console/error-390");

    // Ficha real, a los dos anchos (donde sigue el test).
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${CONSOLE_URL}/tiendas/${storeId}`);
    await expect(page.getByRole("heading", { name: store.storeName, level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "console/detalle-1280");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSeriousA11yViolations(page, "console/detalle-390");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${CONSOLE_URL}/tiendas/${storeId}`);
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

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSeriousA11yViolations(page, "console/auditoria-390");
    await page.setViewportSize({ width: 1280, height: 900 });
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
  const admin = readState().consoleAdmin;
  test.skip(!admin, "El alta del console no corrió en esta pasada: no hay admin que reutilizar.");
  if (!admin) return;

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
  const admin = readState().consoleAdmin;
  test.skip(!admin, "El alta del console no corrió en esta pasada: no hay admin que reutilizar.");
  if (!admin) return;
  const code = admin.backupCodes.at(-1);
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
