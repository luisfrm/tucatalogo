import { useMemo } from "react";
import { applyPrimaryColor, getTheme } from "@tucatalogo/themes";
import type { ColorMode } from "@tucatalogo/types";
import { THEME_TOKEN_CSS_VARS, THEME_TOKEN_KEYS } from "@tucatalogo/themes";

export interface RealStorefrontPreviewProps {
  themeId: string;
  mode?: ColorMode;
  viewport?: "mobile" | "desktop";
  primaryColor?: string;
  className?: string;
}

const DEMO_STORE_NAMES: Record<string, { name: string; tagline: string; category: string }> = {
  rose: {
    name: "Atelier Rosé",
    tagline: "Nueva colección primavera",
    category: "Cosmética & Moda",
  },
  "nude-studio": {
    name: "Nude Studio",
    tagline: "Edición minimalista 2026",
    category: "Calzado & Lino",
  },
  "velvet-noir": {
    name: "Noir Maison",
    tagline: "Cápsula nocturna dorada",
    category: "Alta Boutique",
  },
  "sol-de-verano": {
    name: "Sol & Arena",
    tagline: "Resort & Verano vivo",
    category: "Sandalias",
  },
  "urban-slate": {
    name: "Slate Studio",
    tagline: "Esenciales arquitectónicos",
    category: "Accesorios",
  },
};

const DEMO_PRODUCTS = [
  {
    name: "Sandalia trenzada piel",
    price: "US$ 48,00",
    category: "Calzado",
    image: "/demos/product-sandals.png",
  },
  {
    name: "Sérum botánico glow",
    price: "US$ 34,50",
    category: "Cuidado",
    image: "/demos/product-serum.png",
  },
  {
    name: "Bolso estructurado",
    price: "US$ 89,00",
    category: "Bolsos",
    image: "/demos/product-bag.png",
  },
  {
    name: "Pack esenciales",
    price: "US$ 64,00",
    category: "Destacado",
    image: "/demos/hero-collection.png",
  },
] as const;

/**
 * Interactive, high-fidelity storefront preview using the exact CSS token
 * contract of `packages/themes` and real product photography.
 */
export function RealStorefrontPreview({
  themeId,
  mode = "light",
  viewport = "mobile",
  primaryColor,
  className,
}: RealStorefrontPreviewProps) {
  const storeMeta = DEMO_STORE_NAMES[themeId] ?? DEMO_STORE_NAMES.rose;

  const inlineStyle = useMemo(() => {
    if (!primaryColor || !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      return undefined;
    }
    try {
      const theme = getTheme(themeId);
      const base = theme.modes[mode];
      const resolved = applyPrimaryColor(base, mode, primaryColor, theme.colorProfile);
      const vars: Record<string, string> = {};
      for (const key of THEME_TOKEN_KEYS) {
        vars[THEME_TOKEN_CSS_VARS[key]] = resolved[key];
      }
      return vars as React.CSSProperties;
    } catch {
      return undefined;
    }
  }, [themeId, mode, primaryColor]);

  const products = viewport === "desktop" ? DEMO_PRODUCTS : DEMO_PRODUCTS.slice(0, 2);

  return (
    <div
      data-theme={themeId}
      data-color-mode={mode}
      style={inlineStyle}
      aria-hidden="true"
      className={[
        "flex flex-col overflow-hidden bg-[var(--color-bg)] font-body text-[var(--color-text)] transition-colors duration-200",
        className ?? "",
      ].join(" ")}
    >
      {/* Store Header */}
      <div className="flex items-center justify-between gap-2 border-b-[length:var(--border-width)] border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="grid size-6 place-items-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-[var(--color-on-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {storeMeta.name.slice(0, 1)}
          </span>
          <span
            className="text-xs text-[var(--color-text)]"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight, 600)",
              letterSpacing: "var(--tracking-heading, -0.02em)",
            }}
          >
            {storeMeta.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {viewport === "desktop" ? (
            <div className="mr-2 flex items-center gap-2 text-[10px] font-medium text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text)]">Inicio</span>
              <span>Productos</span>
              <span>Categorías</span>
            </div>
          ) : null}
          <span className="rounded-[var(--radius-full)] bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-primary)]">
            {storeMeta.category}
          </span>
        </div>
      </div>

      {/* Hero Carousel Preview */}
      <div className="relative overflow-hidden border-b-[length:var(--border-width)] border-[var(--color-border)]">
        <div className={viewport === "desktop" ? "aspect-[16/7]" : "aspect-[16/9]"}>
          <img
            src="/demos/hero-collection.png"
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div
          className="absolute inset-0 flex flex-col justify-end p-3.5 sm:p-4"
          style={{ background: "var(--hero-overlay)" }}
        >
          <p
            className="text-sm leading-tight text-white sm:text-base"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight, 600)",
              letterSpacing: "var(--tracking-heading, -0.02em)",
            }}
          >
            {storeMeta.tagline}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-[var(--radius-button,var(--radius-md))] bg-[var(--color-primary)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)]">
              Explorar catálogo
            </span>
            <span className="flex gap-1">
              <span className="h-1.5 w-4 rounded-full bg-white" />
              <span className="size-1.5 rounded-full bg-white/50" />
              <span className="size-1.5 rounded-full bg-white/50" />
            </span>
          </div>
        </div>
      </div>

      {/* Category Strip */}
      <div className="flex items-center gap-1.5 overflow-hidden px-3 pt-3">
        {["Todas", "Calzado", "Cuidado", "Bolsos"].map((cat, idx) => (
          <span
            key={cat}
            className={[
              "rounded-[var(--radius-full)] border-[length:var(--border-width)] px-2 py-0.5 text-[9px] font-medium whitespace-nowrap",
              idx === 0
                ? "border-transparent bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]",
            ].join(" ")}
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Product Grid */}
      <div
        className={[
          "grid gap-2.5 p-3",
          viewport === "desktop" ? "grid-cols-4" : "grid-cols-2",
        ].join(" ")}
      >
        {products.map((product) => (
          <article
            key={product.name}
            className="flex flex-col overflow-hidden rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
          >
            <div className="aspect-square overflow-hidden bg-[var(--color-surface-2)]">
              <img
                src={product.image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between gap-1.5 p-2">
              <div>
                <p className="text-[8px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
                  {product.category}
                </p>
                <p
                  className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-[var(--color-text)]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight, 600)",
                  }}
                >
                  {product.name}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-[var(--color-price)] tabular-nums">
                  {product.price}
                </p>
              </div>
              <span className="inline-flex w-full items-center justify-center rounded-[var(--radius-button,var(--radius-md))] bg-[var(--color-whatsapp)] px-2 py-1 text-[8px] font-semibold text-[var(--color-on-whatsapp)]">
                Pedir por WhatsApp
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
