import type { Page } from "@playwright/test";

/**
 * Fixtures de imagen generadas en el propio navegador.
 *
 * El producto normaliza a WebP en el cliente (PLAN §6 D5), así que el test debe
 * entregar un PNG/JPG real: se dibuja en un canvas del navegador y se convierte
 * a buffer para `setInputFiles`.
 */
export interface PngFixture {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export async function createPng(
  page: Page,
  { width, height, hue = 340, label = "" }: { width: number; height: number; hue?: number; label?: string },
): Promise<PngFixture> {
  const dataUrl = await page.evaluate(
    ({ w, h, baseHue, text }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Sin contexto 2D");

      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, `hsl(${baseHue} 62% 72%)`);
      gradient.addColorStop(1, `hsl(${(baseHue + 40) % 360} 48% 38%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.28, Math.min(w, h) * 0.16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = Math.max(6, Math.round(Math.min(w, h) * 0.02));
      ctx.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);

      if (text) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = `600 ${Math.round(Math.min(w, h) * 0.09)}px sans-serif`;
        ctx.fillText(text, w * 0.1, h * 0.86);
      }

      return canvas.toDataURL("image/png");
    },
    { w: width, h: height, baseHue: hue, text: label },
  );

  const base64 = dataUrl.split(",")[1] ?? "";
  return {
    name: `${label || "fixture"}-${width}x${height}.png`.replace(/\s+/g, "-").toLowerCase(),
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

/** PNG pequeño que respeta el máximo de 2 MB de entrada. */
export function productFixture(page: Page, label: string): Promise<PngFixture> {
  return createPng(page, { width: 1200, height: 1200, hue: 330, label });
}

/** Par de imágenes del hero: encuadre escritorio y encuadre móvil. */
export function heroFixtures(page: Page, label: string): Promise<[PngFixture, PngFixture]> {
  return Promise.all([
    createPng(page, { width: 1600, height: 900, hue: 210, label: `${label}-desktop` }),
    createPng(page, { width: 900, height: 1200, hue: 210, label: `${label}-mobile` }),
  ]);
}
