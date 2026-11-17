import type { PublicProductCard } from "@tucatalogo/types";
import { Link } from "react-router";

import { productHref } from "~/lib/urls";

import { StoreImage } from "./store-image";

export interface ProductCardData extends PublicProductCard {
  /** Formateado en el loader con la moneda de la tienda. */
  priceLabel: string;
}

/** Tarjeta de la grilla del catálogo. Precio visible sin interacción. */
export function ProductCard({ product, siteId }: { product: ProductCardData; siteId: string | null }) {
  return (
    <Link
      to={productHref(product.slug, { siteId })}
      className="group flex flex-col gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg border-[length:var(--border-width)] border-border bg-surface-2">
        {product.image ? (
          <StoreImage
            image={product.image}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="transition-transform duration-200 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
            Sin imagen
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {/* `h2`: la home ya tiene un `h1` (nombre de la tienda) y saltar a `h3`
            rompía el orden de encabezados (Lighthouse/heading-order). */}
        <h2 className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</h2>
        <p className="text-base font-semibold text-price">{product.priceLabel}</p>
      </div>
    </Link>
  );
}
