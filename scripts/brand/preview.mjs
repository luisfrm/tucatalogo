/**
 * Hoja de pruebas de los activos de marca (no se despliega: escribe en
 * `tmp/brand-preview/`).
 *
 *   node scripts/brand/preview.mjs
 *
 * Qué comprueba, mirando los píxeles de verdad:
 *   1. cada lockup en su tamaño nativo sobre papel, vino y fondo oscuro;
 *   2. el favicon rasterizado a **16 × 16** exactos y ampliado ×11 con
 *      `image-rendering: pixelated` (así se ve lo que ve el navegador, no un
 *      render a 128 px que engaña);
 *   3. las dos pestañas juntas, en barra clara y en barra oscura;
 *   4. los `apple-touch-icon` (180 px) y las OG (1200 × 630) a tamaño real.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const OUT = join(ROOT, "tmp/brand-preview");
const BRAND = join(ROOT, "assets/brand");
const WINE = "#A40040";
const PAPER = "#FCF4EE";
const DARK = "#130A0E";

await mkdir(OUT, { recursive: true });

const toDataUri = async (file) =>
  "data:image/svg+xml;base64," + (await readFile(file)).toString("base64");

const logos = (await readdir(BRAND)).filter((f) => f.endsWith(".svg")).sort();
const logoData = Object.fromEntries(
  await Promise.all(logos.map(async (f) => [f, await toDataUri(join(BRAND, f))])),
);

const commercialFavicon = await toDataUri(join(ROOT, "apps/commercial/public/favicon.svg"));
const consoleFavicon = await toDataUri(join(ROOT, "apps/console/public/favicon.svg"));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Rasteriza un SVG a un tamaño exacto y lo devuelve como data URI. */
async function raster(dataUri, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent"><img src="${dataUri}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  const buffer = await page.screenshot({
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: true,
  });
  return "data:image/png;base64," + buffer.toString("base64");
}

const favicons = {};
for (const [name, uri] of [
  ["commercial", commercialFavicon],
  ["console", consoleFavicon],
]) {
  favicons[name] = {
    "16": await raster(uri, 16),
    "24": await raster(uri, 24),
    "32": await raster(uri, 32),
    "180": await raster(uri, 180),
  };
}

const logoRow = (file, uri) => `
  <section>
    <h2>${file}</h2>
    <div class="strip paper"><img src="${uri}" alt=""></div>
    <div class="strip wine"><img src="${uri}" alt=""></div>
    <div class="strip dark"><img src="${uri}" alt=""></div>
    <div class="strip small"><img src="${uri}" height="24" alt=""><span>a 24 px de alto</span></div>
  </section>`;

const faviconCard = (name, data) => `
  <section>
    <h2>favicon · ${name}</h2>
    <div class="grid">
      <figure><img class="pix" src="${data["16"]}" width="176" height="176"><figcaption>16 px ×11</figcaption></figure>
      <figure><img class="pix" src="${data["24"]}" width="168" height="168"><figcaption>24 px ×7</figcaption></figure>
      <figure><img class="pix" src="${data["32"]}" width="160" height="160"><figcaption>32 px ×5</figcaption></figure>
      <figure><img src="${data["16"]}" width="16" height="16"><figcaption>16 real</figcaption></figure>
      <figure><img src="${data["32"]}" width="32" height="32"><figcaption>32 real</figcaption></figure>
      <figure><img src="${data["180"]}" width="90" height="90" style="border-radius:8px"><figcaption>180 (icono)</figcaption></figure>
    </div>
  </section>`;

const tabs = `
  <section>
    <h2>las dos pestañas juntas</h2>
    <div class="tabbar light">
      <div class="tab active"><img src="${favicons.commercial["16"]}" width="16" height="16"><span>tucatalogo.live</span></div>
      <div class="tab"><img src="${favicons.console["16"]}" width="16" height="16"><span>console.tucatalogo.live</span></div>
    </div>
    <div class="tabbar dark">
      <div class="tab active"><img src="${favicons.commercial["16"]}" width="16" height="16"><span>tucatalogo.live</span></div>
      <div class="tab"><img src="${favicons.console["16"]}" width="16" height="16"><span>console.tucatalogo.live</span></div>
    </div>
  </section>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 18px; background: #efeae3; color: #23151a;
         font: 13px/1.4 system-ui, sans-serif; }
  h1 { font-size: 15px; margin: 0 0 14px; letter-spacing: .02em; }
  section { background: #fff; border-radius: 12px; padding: 12px 16px 16px; margin-bottom: 12px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6b5b5f; margin: 0 0 10px; }
  .strip { padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; display: flex; align-items: center; }
  .strip img { display: block; height: 40px; width: auto; }
  .strip.paper { background: ${PAPER}; }
  .strip.wine { background: ${WINE}; }
  .strip.dark { background: ${DARK}; }
  .strip.small { background: #fff; border: 1px solid #eee; }
  .strip.small img { height: 24px; }
  .strip.small span { font-size: 11px; color: #999; }
  .grid { display: flex; gap: 18px; align-items: flex-end; flex-wrap: wrap; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  figcaption { font-size: 9px; color: #999; }
  img.pix { image-rendering: pixelated; display: block; }
  .tabbar { display: flex; gap: 4px; padding: 8px 8px 0; border-radius: 10px 10px 0 0; margin-bottom: 10px; }
  .tabbar.light { background: #dee1e6; }
  .tabbar.dark { background: #202124; }
  .tab { display: flex; align-items: center; gap: 7px; padding: 7px 14px 7px 8px; border-radius: 8px 8px 0 0;
         font-size: 12px; }
  .tabbar.light .tab { color: #3c4043; }
  .tabbar.light .tab.active { background: #f8f9fa; }
  .tabbar.dark .tab { color: #e8eaed; }
  .tabbar.dark .tab.active { background: #35363a; }
</style></head><body>
  <h1>TuCatálogo · hoja de pruebas de marca</h1>
  ${logos.map((file) => logoRow(file, logoData[file])).join("")}
  ${faviconCard("commercial", favicons.commercial)}
  ${faviconCard("console", favicons.console)}
  ${tabs}
</body></html>`;

await page.setViewportSize({ width: 1000, height: 900 });
await page.setContent(html);
await page.screenshot({ path: join(OUT, "sheet.png"), fullPage: true });
writeFileSync(join(OUT, "sheet.html"), html);

/* OG a tamaño real, para revisarlas juntas */
const ogCommercial = await readFile(join(ROOT, "apps/commercial/public/og.png"));
const ogConsole = await readFile(join(ROOT, "apps/console/public/og.png"));
writeFileSync(join(OUT, "commercial-og.png"), ogCommercial);
writeFileSync(join(OUT, "console-og.png"), ogConsole);

await page.setViewportSize({ width: 1200, height: 1260 });
await page.setContent(
  `<body style="margin:0;background:#ddd">${[
    ["commercial", ogCommercial],
    ["console", ogConsole],
  ]
    .map(
      ([, buffer]) =>
        `<img src="data:image/png;base64,${buffer.toString("base64")}" style="display:block;width:1200px;height:630px">`,
    )
    .join("")}</body>`,
);
await page.screenshot({ path: join(OUT, "og.png"), fullPage: true });

await browser.close();
console.log(`Hoja de pruebas en ${OUT}`);
