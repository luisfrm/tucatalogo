import type { PublicProductCard } from "@tucatalogo/types";
import { Link } from "react-router";

import { productHref } from "~/lib/urls";

import { StoreImage } from "./store-image";

export interface ProductCardData extends PublicProductCard {
  /** Formatted in the loader with the store currency. */
  priceLabel: string;
}

/** Catalog grid card using theme surface, card radius, and shadow tokens. */
export function ProductCard({
  product,
  siteId,
  headingTag = "h2",
}: {
  product: ProductCardData;
  siteId: string | null;
  headingTag?: "h2" | "h3";
}) {
  const Heading = headingTag;

  return (
    <Link
      to={productHref(product.slug, { siteId })}
      className="group flex flex-col gap-2.5 rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-border bg-surface p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
    >
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
        {product.image ? (
          <StoreImage
            image={product.image}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
            Sin imagen
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 px-1 pb-1">
        <Heading className="line-clamp-2 font-heading text-sm font-medium leading-snug tracking-[var(--tracking-heading,normal)] text-text">
          {product.name}
        </Heading>
        <p className="text-base font-semibold tabular-nums text-price">
          {product.priceLabel}
        </p>
      </div>
    </Link>
  );
}
