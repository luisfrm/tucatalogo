import { expect, test } from "@playwright/test";

import { COMMERCIAL_URL, CONSOLE_URL } from "../lib/config";

/**
 * Activos de marca: lo que se sirve y lo que se declara en el `<head>`.
 *
 * Comprueba lo que un usuario (y un rastreador) ve de verdad en el HTML de
 * producción: iconos con su `type`/`sizes`, `theme-color`, y un juego Open
 * Graph **con URL absoluta de producción** — nunca una ruta relativa ni
 * `localhost`, que es el error clásico al compartir el enlace.
 */
const PROD_OG = "https://tucatalogo.live/og.png";
const CONSOLE_PROD_OG = "https://console.tucatalogo.live/og.png";

test.describe("marca · landing", () => {
  test("declara iconos, theme-color y Open Graph absoluto", async ({ page }) => {
    const response = await page.goto(`${COMMERCIAL_URL}/`);
    expect(response?.status()).toBe(200);

    const head = page.locator("head");

    await expect(
      head.locator('link[rel="icon"][type="image/svg+xml"][sizes="any"]'),
    ).toHaveAttribute("href", "/favicon.svg");
    await expect(
      head.locator('link[rel="icon"][type="image/png"][sizes="32x32"]'),
    ).toHaveAttribute("href", "/favicon-32.png");
    await expect(
      head.locator('link[rel="apple-touch-icon"][sizes="180x180"]'),
    ).toHaveAttribute("href", "/apple-touch-icon.png");
    await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#FCF4EE",
    );

    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      PROD_OG,
    );
    await expect(head.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );
    await expect(
      head.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute("content", "630");
    await expect(head.locator('meta[property="og:image:alt"]')).not.toHaveAttribute(
      "content",
      "",
    );
    await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(head.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      PROD_OG,
    );

    // Un solo juego: React Router pinta el meta de la ruta hoja.
    await expect(head.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(head.locator('meta[property="og:image"]')).toHaveCount(1);
  });

  test("sirve favicon, icono de iOS y OG con su tipo y tamaño", async ({
    request,
  }) => {
    const favicon = await request.get(`${COMMERCIAL_URL}/favicon.svg`);
    expect(favicon.status()).toBe(200);
    expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
    const svg = await favicon.text();
    expect(svg).not.toContain("<text");
    expect(Buffer.byteLength(svg, "utf8")).toBeLessThanOrEqual(2 * 1024);

    const png32 = await request.get(`${COMMERCIAL_URL}/favicon-32.png`);
    expect(png32.status()).toBe(200);
    expect(png32.headers()["content-type"]).toContain("image/png");

    const touch = await request.get(`${COMMERCIAL_URL}/apple-touch-icon.png`);
    expect(touch.status()).toBe(200);
    const touchPng = await touch.body();
    // Cabecera IHDR de PNG: ancho y alto en big-endian.
    expect(touchPng.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(touchPng.readUInt32BE(16)).toBe(180);
    expect(touchPng.readUInt32BE(20)).toBe(180);

    const og = await request.get(`${COMMERCIAL_URL}/og.png`);
    expect(og.status()).toBe(200);
    const ogBody = await og.body();
    expect(ogBody.readUInt32BE(16)).toBe(1200);
    expect(ogBody.readUInt32BE(20)).toBe(630);
    expect(ogBody.byteLength).toBeLessThanOrEqual(200 * 1024);
  });

  test("/favicon.ico sigue redirigiendo al SVG", async ({ request }) => {
    const response = await request.get(`${COMMERCIAL_URL}/favicon.ico`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe("/favicon.svg");
  });
});

test.describe("marca · console", () => {
  test("declara su propio favicon y OG, y sigue siendo noindex", async ({
    page,
  }) => {
    const response = await page.goto(`${CONSOLE_URL}/login`);
    expect(response?.status()).toBe(200);

    const head = page.locator("head");

    await expect(
      head.locator('link[rel="icon"][type="image/svg+xml"]'),
    ).toHaveAttribute("href", "/favicon.svg");
    await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#F8F5F1",
    );
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      CONSOLE_PROD_OG,
    );
    await expect(head.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );

    const favicon = await (await page.request.get(`${CONSOLE_URL}/favicon.svg`)).text();
    expect(favicon).not.toContain("<text");
  });

  test("el favicon del console no es el de la landing", async ({ request }) => {
    const [commercial, console] = await Promise.all([
      request.get(`${COMMERCIAL_URL}/favicon.svg`),
      request.get(`${CONSOLE_URL}/favicon.svg`),
    ]);

    expect(await commercial.text()).not.toBe(await console.text());
  });
});
