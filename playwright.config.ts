import { defineConfig, devices } from "@playwright/test";

/**
 * E2E del MVP (PLAN §14).
 *
 * Los servidores son los de `pnpm dev` (api 9797, web 5173, commercial 5174,
 * console 5175). `reuseExistingServer` permite correr los tests con el entorno
 * ya levantado; si no hay nada escuchando, Playwright ejecuta `pnpm dev`.
 *
 * Los proyectos van encadenados con dependencias porque comparten una tienda
 * desechable creada por `setup` (registro real por UI) y el console se crea una
 * sola vez:
 *
 *   setup → panel → storefront → isolation → axe → console → console-delete
 *   (brand corre aparte: no toca datos)
 *
 * Las dependencias expresan **datos** (`setup` crea la tienda, `panel` su
 * catálogo), no salud: un proyecto que falla solo salta a los que dependen de
 * esos datos. Las auditorías de axe viven en proyectos de los que nadie depende
 * (`axe`, `console`) y el borrado, que sí depende de todos, va al final: así una
 * violación de accesibilidad nunca impide ver el resultado del resto.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "setup", testDir: "./e2e/setup", testMatch: /.*\.setup\.ts/ },
    {
      // Activos de marca: no dependen de datos, así que no esperan a `setup`.
      name: "brand",
      testDir: "./e2e/tests",
      testMatch: /brand\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "panel",
      testDir: "./e2e/tests",
      testMatch: /panel\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront",
      testDir: "./e2e/tests",
      testMatch: /storefront\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "isolation",
      testDir: "./e2e/tests",
      testMatch: /isolation\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "axe",
      testDir: "./e2e/tests",
      testMatch: /axe\.spec\.ts/,
      dependencies: ["setup", "panel", "storefront"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "console",
      testDir: "./e2e/tests",
      testMatch: /console\.spec\.ts/,
      dependencies: ["setup", "panel"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Último a propósito: elimina la tienda desechable y deja el estado final.
      name: "console-delete",
      testDir: "./e2e/tests",
      testMatch: /console-delete\.spec\.ts/,
      dependencies: ["setup", "panel", "storefront", "isolation", "axe", "console"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:9797/health",
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
