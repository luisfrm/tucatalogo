/**
 * Generador de los activos de marca de TuCatálogo (`tucatalogo.live` y
 * `console.tucatalogo.live`).
 *
 *   node scripts/brand/build.mjs
 *
 * Escribe, desde una única fuente de geometría y color:
 *   - `assets/brand/*.svg`      marca, lockups y monocromos (fuente de verdad);
 *   - `apps/<app>/public/…`     `favicon.svg`, `favicon-32.png`,
 *                               `apple-touch-icon.png` y `og.png`.
 *
 * Sin dependencias nuevas: Playwright ya está en el repo y se usa para
 * (a) medir la Fraunces real y (b) rasterizar PNG y las imágenes OG desde HTML,
 * de modo que el texto salga con las letras verdaderas y no deformado.
 *
 * Los SVG no llevan `hex` fuera de la paleta de marca y el monograma son
 * `<path>`/`<rect>`: no depende de que ninguna fuente cargue. Solo el wordmark
 * usa `<text>`; su cadena de fallback es la misma que declara el sistema de
 * diseño (`Fraunces`, `Fraunces Fallback`, Georgia).
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const FONTS = join(ROOT, "packages/themes/fonts");
const OUT_BRAND = join(ROOT, "assets/brand");

/* ------------------------------------------------------------------ *
 * Identidad publicada (packages/themes/src/themes/admin.ts)
 * ------------------------------------------------------------------ */
const C = {
  wine: "#A40040",
  wineHover: "#870037",
  accent: "#DD6F23",
  accentOn: "#2A0F04",
  paper: "#FCF4EE",
  surface: "#FFFCFA",
  ink: "#23151A",
  muted: "#614C53",
  primarySubtle: "#FFE6E8",
  consoleBg: "#F8F5F1",
  consoleSurface: "#FFFDFC",
  consoleInk: "#1F1815",
  consoleMuted: "#5E5450",
};

const FONT_STACK =
  "Fraunces, 'Fraunces Fallback', Georgia, 'Times New Roman', serif";
const UI_STACK = "Figtree, 'Figtree Fallback', Arial, 'Helvetica Neue', sans-serif";

/* ------------------------------------------------------------------ *
 * Geometría del monograma (viewBox 32 × 32)
 *
 * El mark es la marca real: "T" + "C" geométricas, dibujadas como relleno
 * (rect + anillo abierto), no como texto. Medidas en una retícula de 32:
 * mayúscula 15.4, asta 3.7, caja del T 7.8, anillo del C ⌀15.4 con apertura
 * de 104° para que no lea "O".
 * ------------------------------------------------------------------ */
const TILE_RADIUS_RATIO = 0.25; // 8/32 — el mismo 25 % que --radius-md sobre 2.5rem

const GLYPH = {
  capTop: 8.3,
  capBot: 23.7,
  stroke: 3.7,
  barW: 7.8,
  x0: 3.2,
  gap: 2.2,
  ringRadius: 7.7,
  aperture: 104,
};

const round = (value) => Math.round(value * 100) / 100;

function pointOnCircle(cx, cy, r, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)];
}

/** Anillo abierto (el "C") como un solo path con relleno. */
function openRing(cx, cy, outer, inner, from, to) {
  const [ox1, oy1] = pointOnCircle(cx, cy, outer, from);
  const [ox2, oy2] = pointOnCircle(cx, cy, outer, to);
  const [ix1, iy1] = pointOnCircle(cx, cy, inner, from);
  const [ix2, iy2] = pointOnCircle(cx, cy, inner, to);
  const largeArc = (to - from) % 360 > 180 ? 1 : 0;
  return [
    `M${round(ox1)} ${round(oy1)}`,
    `A${outer} ${outer} 0 ${largeArc} 1 ${round(ox2)} ${round(oy2)}`,
    `L${round(ix2)} ${round(iy2)}`,
    `A${inner} ${inner} 0 ${largeArc} 0 ${round(ix1)} ${round(iy1)}`,
    "Z",
  ].join("");
}

/**
 * Monograma "TC" a una tinta (`color`). Sin fondo: se compone con la tile o
 * solo, según la pieza.
 */
function monogram(color = "currentColor") {
  const { capTop, capBot, stroke, barW, x0, gap, ringRadius, aperture } = GLYPH;
  const stemX = x0 + barW / 2 - stroke / 2;
  const cx = x0 + barW + gap + ringRadius;
  const cy = (capTop + capBot) / 2;
  const ring = openRing(
    cx,
    cy,
    ringRadius,
    ringRadius - stroke,
    aperture / 2,
    360 - aperture / 2,
  );
  return [
    `<g fill="${color}">`,
    `<rect x="${x0}" y="${capTop}" width="${barW}" height="${stroke}"/>`,
    `<rect x="${round(stemX)}" y="${capTop}" width="${stroke}" height="${round(capBot - capTop)}"/>`,
    `<path d="${ring}"/>`,
    "</g>",
  ].join("");
}

/**
 * Glifo de favicon: a 16 px el "TC" no cabe (dos letras en 16 px se embotan),
 * así que el mark se simplifica a **una** de sus dos letras, más gruesa y
 * abierta. "T" para la landing, "C" para el console: juntas siguen leyendo
 * "TC" y en una pestaña se distinguen al instante.
 */
const FAVICON_GLYPH = {
  T: { barW: 17.4, stroke: 5, top: 7.1, bottom: 24.9 },
  C: { ringRadius: 9.2, stroke: 4.8, aperture: 76 },
};

function faviconGlyph(kind, color = "#FFFFFF") {
  if (kind === "T") {
    const { barW, stroke, top, bottom } = FAVICON_GLYPH.T;
    return [
      `<g fill="${color}">`,
      `<rect x="${round((32 - barW) / 2)}" y="${top}" width="${barW}" height="${stroke}"/>`,
      `<rect x="${round(16 - stroke / 2)}" y="${top}" width="${stroke}" height="${round(bottom - top)}"/>`,
      "</g>",
    ].join("");
  }
  const { ringRadius, stroke, aperture } = FAVICON_GLYPH.C;
  return `<path fill="${color}" d="${openRing(16, 16, ringRadius, ringRadius - stroke, aperture / 2, 360 - aperture / 2)}"/>`;
}

function tileSvg({ fill = C.wine, inner = "", radius = 8, size = 32 }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img">`,
    `<rect width="32" height="32" rx="${radius}" fill="${fill}"/>`,
    inner,
    "</svg>",
  ].join("");
}

/* ------------------------------------------------------------------ *
 * Lockups (mark + wordmark), medidos en la Fraunces real
 * ------------------------------------------------------------------ */
const WORDMARK = {
  text: "TuCatálogo",
  size: 30,
  weight: 600,
  letterSpacing: -0.6,
};
const CHIP = { text: "Console", size: 12, weight: 700, letterSpacing: 1.3, height: 26 };
const LOCKUP = { markSize: 40, gap: 12, chipGap: 14, widthReserve: 1.09 };

async function measureWordmark(page) {
  return page.evaluate(
    async ({ text, size, weight, letterSpacing }) => {
      await document.fonts.load(`${weight} ${size}px Fraunces`);
      await document.fonts.ready;
      const span = document.createElement("span");
      span.textContent = text;
      span.style.cssText = `position:absolute;left:-9999px;font-family:Fraunces;font-weight:${weight};font-size:${size}px;letter-spacing:${letterSpacing}px;white-space:pre`;
      document.body.append(span);
      const width = span.getBoundingClientRect().width;
      const canvas = document.createElement("canvas").getContext("2d");
      canvas.font = `${weight} ${size}px Fraunces`;
      const capAscent = canvas.measureText("T").actualBoundingBoxAscent;
      span.remove();
      return { width, capAscent };
    },
    WORDMARK,
  );
}

async function measureChip(page) {
  return page.evaluate(
    async ({ text, size, weight, letterSpacing }) => {
      await document.fonts.load(`${weight} ${size}px Figtree`);
      await document.fonts.ready;
      const span = document.createElement("span");
      span.textContent = text.toUpperCase();
      span.style.cssText = `position:absolute;left:-9999px;font-family:Figtree;font-weight:${weight};font-size:${size}px;letter-spacing:${letterSpacing}px;white-space:pre`;
      document.body.append(span);
      const width = span.getBoundingClientRect().width;
      span.remove();
      return { width };
    },
    CHIP,
  );
}

/**
 * Lockup horizontal. `mono` produce una tinta (sin tile); `console` añade el
 * chip de producto y `onDark` invierte las tintas.
 */
function lockup({ word, chip, markInk, tint, mono, fontFamily, wordmark }) {
  const { markSize, gap, chipGap, widthReserve } = LOCKUP;
  const baseline = markSize / 2 + wordmark.capAscent / 2;
  const textX = markSize + gap;
  const width = textX + wordmark.width * widthReserve;
  const parts = [];

  if (mono) {
    // Una tinta: el monograma escala a la caja del wordmark, sin tile.
    const scale = markSize / 32;
    parts.push(
      `<g transform="translate(0 ${round((markSize - markSize) / 2)}) scale(${round(scale * 1)})">${monogram(markInk)}</g>`,
    );
  } else {
    parts.push(
      `<rect width="${markSize}" height="${markSize}" rx="${round(markSize * TILE_RADIUS_RATIO)}" fill="${C.wine}"/>`,
      `<g transform="scale(${round(markSize / 32)})">${monogram("#FFFFFF")}</g>`,
    );
  }

  parts.push(
    `<text x="${round(textX)}" y="${round(baseline)}" font-family="${fontFamily}" font-size="${WORDMARK.size}" font-weight="${WORDMARK.weight}" letter-spacing="${WORDMARK.letterSpacing}" fill="${tint}">${word}</text>`,
  );

  let chipBox = null;
  const ringOpacity = chip ? (chip.ringOpacity ?? 0.28) : 0;
  if (chip) {
    const chipX = textX + wordmark.width + chipGap;
    const chipW = round(chip.width + 24);
    const chipY = round((markSize - CHIP.height) / 2);
    chipBox = { x: chipX, y: chipY, w: chipW };
    parts.push(
      `<rect x="${round(chipX)}" y="${chipY}" width="${chipW}" height="${CHIP.height}" rx="${CHIP.height / 2}" fill="${chip.fill}"/>`,
      `<text x="${round(chipX + chipW / 2)}" y="${round(chipY + CHIP.height / 2 + CHIP.size * 0.36)}" text-anchor="middle" font-family="${UI_STACK}" font-size="${CHIP.size}" font-weight="${CHIP.weight}" letter-spacing="${CHIP.letterSpacing}" fill="${chip.text}">${CHIP.text.toUpperCase()}</text>`,
    );
    if (chip.ring !== "none") {
      parts.push(
        `<rect x="${round(chipX)}" y="${chipY}" width="${chipW}" height="${CHIP.height}" rx="${CHIP.height / 2}" fill="none" stroke="${chip.ring}"${ringOpacity === 1 ? "" : ` stroke-opacity="${ringOpacity}"`}/>`,
      );
    }
  }

  const total = chipBox ? chipBox.x + chipBox.w : width;
  const finalWidth = round(total + (wordmark.width * (widthReserve - 1)) / 2);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalWidth} ${markSize}" width="${finalWidth}" height="${markSize}" role="img">`,
    `<title>${word}${chip ? " Console" : ""}</title>`,
    ...parts,
    "</svg>",
  ].join("");
}

/* ------------------------------------------------------------------ *
 * HTML de las imágenes OG (1200 × 630)
 * ------------------------------------------------------------------ */
const OG = { width: 1200, height: 630 };

const ogBaseCss = `
  @font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-latin.woff2") format("woff2"); font-weight: 100 900; font-display: block; }
  @font-face { font-family: "Figtree"; src: url("/fonts/figtree-latin.woff2") format("woff2"); font-weight: 300 900; font-display: block; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${OG.width}px; height: ${OG.height}px; overflow: hidden; }
  body { font-family: "Figtree", sans-serif; -webkit-font-smoothing: antialiased; }
  .display { font-family: "Fraunces", serif; font-optical-sizing: auto; }
`;

function markHtml(size, { tile = C.wine, ink = "#FFFFFF", radius = true } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="${radius ? 8 : 0}" fill="${tile}"/>
    <g transform="scale(1)">${monogram(ink)}</g>
  </svg>`;
}

const ogCommercial = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${ogBaseCss}
  body { background: ${C.paper}; color: ${C.ink}; }
  .frame { position: relative; width: ${OG.width}px; height: ${OG.height}px; padding: 56px 72px 52px; }
  .left { width: 640px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .name { font-family: "Fraunces", serif; font-weight: 600; font-size: 38px; letter-spacing: -0.02em; color: ${C.ink}; }
  h1 { margin-top: 36px; font-family: "Fraunces", serif; font-optical-sizing: auto; font-weight: 600;
       font-size: 66px; line-height: 1.05; letter-spacing: -0.03em; color: ${C.ink}; }
  h1 em { font-style: normal; color: ${C.wine}; }
  .sub { margin-top: 24px; font-weight: 400; font-size: 34px; line-height: 1.32; color: ${C.muted}; max-width: 560px; }
  .domain { position: absolute; left: 72px; bottom: 52px; display: inline-flex; align-items: center; gap: 12px;
            background: ${C.primarySubtle}; color: ${C.wine}; border-radius: 999px; padding: 10px 24px;
            font-weight: 600; font-size: 32px; letter-spacing: -0.01em; }
  .slab { position: absolute; right: 0; top: 0; width: 440px; height: ${OG.height}px; background: ${C.wine};
          padding: 40px 40px 44px; display: flex; flex-direction: column; justify-content: space-between; }
  .slab .seal { opacity: .96; }
  .chat { display: flex; flex-direction: column; gap: 18px; margin: auto 0; }
  .msg { font-size: 32px; line-height: 1.26; padding: 18px 22px 20px; max-width: 320px; }
  .in { background: ${C.surface}; color: ${C.ink}; border-radius: 24px 24px 24px 8px; align-self: flex-start; }
  .out { background: ${C.primarySubtle}; color: ${C.wine}; border-radius: 24px 24px 8px 24px; align-self: flex-end;
         font-weight: 500; }
  .dot { position: absolute; right: 40px; top: 44px; width: 30px; height: 30px; border-radius: 50%; background: ${C.accent}; }
</style></head><body><div class="frame">
  <div class="left">
    <div class="brand">${markHtml(56)}<span class="name">TuCatálogo</span></div>
    <h1>Tu catálogo online,<br>listo para vender<br>por <em>WhatsApp</em></h1>
    <p class="sub">Productos, categorías y portada desde el móvil.</p>
  </div>
  <div class="slab">
    <div class="seal">${markHtml(84, { tile: "transparent", ink: "#FFFFFF", radius: false })}</div>
    <div class="chat">
      <div class="msg in">¿Tienes el vestido en talla M?</div>
      <div class="msg out">¡Sí! Te lo envío hoy</div>
    </div>
  </div>
  <span class="dot"></span>
  <div class="domain">tucatalogo.live</div>
</div></body></html>`;

const ogConsole = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${ogBaseCss}
  body { background: ${C.consoleBg}; color: ${C.consoleInk}; }
  .frame { position: relative; width: ${OG.width}px; height: ${OG.height}px; }
  header { height: 132px; background: ${C.wine}; display: flex; align-items: center; gap: 14px; padding: 0 72px; }
  header .name { font-family: "Fraunces", serif; font-weight: 600; font-size: 36px; letter-spacing: -0.02em; color: #FFFFFF; }
  header .chip { margin-left: 6px; background: ${C.primarySubtle}; color: ${C.wine}; border-radius: 999px;
                 padding: 7px 18px 8px; font-weight: 700; font-size: 22px; letter-spacing: 0.12em; text-transform: uppercase; }
  main { padding: 48px 72px 0; }
  .copy { width: 580px; }
  h1 { font-family: "Fraunces", serif; font-optical-sizing: auto; font-weight: 600; font-size: 62px;
       line-height: 1.06; letter-spacing: -0.028em; color: ${C.consoleInk}; }
  .sub { margin-top: 20px; font-size: 32px; line-height: 1.34; color: ${C.consoleMuted}; }
  .chips { display: flex; gap: 12px; margin-top: 34px; }
  .chips span { border: 1px solid #E7E1DC; background: ${C.consoleSurface}; color: ${C.consoleMuted};
                border-radius: 999px; padding: 7px 18px 8px; font-size: 32px; font-weight: 500; letter-spacing: -0.01em; }
  .domain { position: absolute; left: 72px; bottom: 48px; font-family: "Figtree", sans-serif; font-weight: 600;
            font-size: 32px; color: ${C.wine}; }
  .card { position: absolute; right: 72px; top: 196px; width: 420px; background: ${C.consoleSurface};
          border: 1px solid #E3DFDA; border-radius: 20px; padding: 22px 24px; box-shadow: 0 18px 40px rgba(122,8,48,0.10); }
  .card .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .card .head span:first-child { font-weight: 600; font-size: 30px; color: ${C.consoleInk}; }
  .card .head span:last-child { font-weight: 500; font-size: 26px; color: ${C.consoleMuted}; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 13px 0; border-top: 1px solid #EFEAE5; }
  .row .nm { font-size: 28px; font-weight: 500; color: ${C.consoleInk}; }
  .row .st { font-size: 26px; font-weight: 600; border-radius: 999px; padding: 4px 14px; }
  .ok { background: ${C.primarySubtle}; color: ${C.wine}; }
  .warn { background: #F3EEEA; color: ${C.consoleMuted}; }
</style></head><body><div class="frame">
  <header>
    ${markHtml(48, { tile: C.paper, ink: C.wine })}
    <span class="name">TuCatálogo</span>
    <span class="chip">Console</span>
  </header>
  <main>
    <div class="copy">
      <h1>Acceso al backoffice</h1>
      <p class="sub">Tiendas, suspensiones, borrado y auditoría. Solo para el equipo.</p>
      <div class="chips"><span>Cloudflare Access</span><span>2FA obligatorio</span></div>
    </div>
  </main>
  <div class="card">
    <div class="head"><span>Tiendas</span><span>128</span></div>
    <div class="row"><span class="nm">boutique-rosa</span><span class="st ok">activa</span></div>
    <div class="row"><span class="nm">sandalia-sur</span><span class="st ok">activa</span></div>
    <div class="row"><span class="nm">makeup-lab</span><span class="st warn">suspendida</span></div>
  </div>
  <div class="domain">console.tucatalogo.live</div>
</div></body></html>`;

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */
const htmlByPath = {
  "/og/commercial": ogCommercial,
  "/og/console": ogConsole,
};

async function main() {
  await mkdir(OUT_BRAND, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  await context.route("http://brand.local/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith("/fonts/")) {
      const body = await readFile(join(FONTS, pathname.slice("/fonts/".length)));
      return route.fulfill({ body, contentType: "font/woff2" });
    }
    const html = htmlByPath[pathname];
    if (html) return route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    return route.fulfill({ status: 404, body: "not found" });
  });

  const page = await context.newPage();
  await page.setViewportSize({ width: OG.width, height: OG.height });
  await page.goto("http://brand.local/og/commercial");
  await page.evaluate(() => document.fonts.ready);

  const wordmark = await measureWordmark(page);
  const chip = await measureChip(page);

  /* SVG ---------------------------------------------------------------- */
  const commercial = lockup({
    word: WORDMARK.text,
    fontFamily: FONT_STACK,
    markInk: "#FFFFFF",
    tint: C.ink,
    wordmark,
  });
  const consoleLockup = lockup({
    word: WORDMARK.text,
    fontFamily: FONT_STACK,
    markInk: "#FFFFFF",
    tint: C.ink,
    wordmark,
    chip: { width: chip.width, fill: C.primarySubtle, text: C.wine, ring: C.wine },
  });

  const monoOnLight = (withChip) =>
    lockup({
      word: WORDMARK.text,
      fontFamily: FONT_STACK,
      markInk: "currentColor",
      tint: "currentColor",
      mono: true,
      wordmark,
      chip: withChip
        ? { width: chip.width, fill: "none", text: "currentColor", ring: "currentColor", ringOpacity: 1 }
        : undefined,
    });
  const monoOnDark = (withChip) =>
    lockup({
      word: WORDMARK.text,
      fontFamily: FONT_STACK,
      markInk: "#FFFFFF",
      tint: "#FFFFFF",
      mono: true,
      wordmark,
      chip: withChip
        ? { width: chip.width, fill: "none", text: "#FFFFFF", ring: "#FFFFFF", ringOpacity: 1 }
        : undefined,
    });

  const svgFiles = {
    "mark.svg": tileSvg({ inner: monogram("#FFFFFF") }),
    "logo-commercial.svg": commercial,
    "logo-console.svg": consoleLockup,
    "logo-commercial-mono-on-light.svg": monoOnLight(false),
    "logo-commercial-mono-on-dark.svg": monoOnDark(false),
    "logo-console-mono-on-light.svg": monoOnLight(true),
    "logo-console-mono-on-dark.svg": monoOnDark(true),
  };

  /**
   * Un SVG de marca solo puede usar la paleta publicada: nada de hex inventados
   * que se desincronicen de los tokens de `packages/themes`.
   */
  const PALETTE = new Set(
    [C.wine, C.accent, C.accentOn, C.paper, C.surface, C.ink, C.primarySubtle, "#FFFFFF"].map(
      (hex) => hex.slice(1).toUpperCase(),
    ),
  );
  const offPalette = [];
  for (const [name, content] of Object.entries(svgFiles)) {
    for (const [, hex] of content.matchAll(/#([0-9a-fA-F]{6})/g)) {
      if (!PALETTE.has(hex.toUpperCase())) {
        offPalette.push(`${name}: #${hex}`);
      }
    }
  }
  if (offPalette.length > 0) {
    throw new Error(
      `Hex fuera de la paleta de marca en los SVG:\n${offPalette.join("\n")}`,
    );
  }

  const sizes = {};
  for (const [name, content] of Object.entries(svgFiles)) {
    await writeFile(join(OUT_BRAND, name), content + "\n", "utf8");
    sizes[`assets/brand/${name}`] = Buffer.byteLength(content) + 1;
  }

  /* FAVICONS ----------------------------------------------------------- */
  const favicons = {
    commercial: {
      glyph: "T",
      tile: C.wine,
      ink: "#FFFFFF",
      app: join(ROOT, "apps/commercial/public"),
    },
    console: {
      glyph: "C",
      tile: C.accent,
      ink: "#FFFFFF",
      app: join(ROOT, "apps/console/public"),
    },
  };

  for (const [, cfg] of Object.entries(favicons)) {
    const svg = tileSvg({ fill: cfg.tile, inner: faviconGlyph(cfg.glyph, cfg.ink) });
    if (svg.includes("<text")) {
      throw new Error("El favicon no puede depender de una fuente: usa geometría.");
    }
    await mkdir(cfg.app, { recursive: true });
    await writeFile(join(cfg.app, "favicon.svg"), svg + "\n", "utf8");
    sizes[`${cfg.app.replace(ROOT, "")}/favicon.svg`] = Buffer.byteLength(svg) + 1;

    // 32 × 32 de respaldo: mismo dibujo que el SVG, rasterizado.
    await page.setViewportSize({ width: 32, height: 32 });
    await page.setContent(
      `<!doctype html><html><body style="margin:0">${svg.replace(
        'width="32" height="32"',
        'width="32" height="32"',
      )}</body></html>`,
    );
    const png32 = await page.screenshot({ clip: { x: 0, y: 0, width: 32, height: 32 }, omitBackground: true });
    await writeFile(join(cfg.app, "favicon-32.png"), png32);
    sizes[`${cfg.app.replace(ROOT, "")}/favicon-32.png`] = png32.length;

    // apple-touch-icon: 180 × 180, cuadrado a sangre (iOS aplica su máscara)
    // y sin transparencia (iOS compone el alfa sobre negro).
    const icon = 180;
    const glyph = 118;
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${glyph}" height="${glyph}">${faviconGlyph(cfg.glyph, cfg.ink)}</svg>`;
    await page.setViewportSize({ width: icon, height: icon });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${icon}px;height:${icon}px;background:${cfg.tile};display:grid;place-items:center">${iconSvg}</body></html>`,
    );
    const touch = await page.screenshot({ clip: { x: 0, y: 0, width: icon, height: icon } });
    await writeFile(join(cfg.app, "apple-touch-icon.png"), touch);
    sizes[`${cfg.app.replace(ROOT, "")}/apple-touch-icon.png`] = touch.length;
  }

  /* OG ----------------------------------------------------------------- */
  const ogTargets = [
    ["/og/commercial", join(ROOT, "apps/commercial/public/og.png")],
    ["/og/console", join(ROOT, "apps/console/public/og.png")],
  ];
  await page.setViewportSize({ width: OG.width, height: OG.height });
  for (const [path, target] of ogTargets) {
    await page.goto(`http://brand.local${path}`);
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: OG.width, height: OG.height } });
    await writeFile(target, png);
    sizes[target.replace(ROOT, "")] = png.length;
  }

  await browser.close();

  /* Informe + presupuestos --------------------------------------------- */
  const budgets = [
    [/favicon\.svg$/, 2 * 1024, "favicon.svg"],
    [/assets\/brand\/.*\.svg$/, 6 * 1024, "logo"],
    [/og\.png$/, 200 * 1024, "og.png"],
  ];
  let failed = false;
  const rows = Object.entries(sizes).map(([file, bytes]) => {
    const budget = budgets.find(([re]) => re.test(file));
    const over = budget ? bytes > budget[1] : false;
    if (over) failed = true;
    return {
      file: file.replace(/\\/g, "/").replace("/public", "/public"),
      kb: (bytes / 1024).toFixed(1),
      budget: budget ? `${(budget[1] / 1024).toFixed(0)} KB` : "—",
      ok: over ? "EXCEDE" : budget ? "ok" : "",
    };
  });
  console.table(rows);
  if (failed) {
    console.error("Presupuesto de peso excedido.");
    process.exitCode = 1;
  }
}

await main();
