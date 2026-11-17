import { cn } from "@tucatalogo/ui";
import type { MediaImage } from "@tucatalogo/types";
import { useRef, useState } from "react";

import { StoreImage } from "./store-image";

/**
 * Galería de la ficha de producto.
 *
 * - La primera foto se renderiza en servidor; el cambio de foto es el único JS
 *   de la ficha (PLAN §9.6).
 * - Teclado: flechas, Inicio y Fin sobre las miniaturas; `aria-pressed` indica
 *   la foto activa y un `aria-live` anuncia el cambio.
 * - Sin `aria-label` inventados: las miniaturas usan texto en español.
 */
export function ProductGallery({ images, productName }: { images: MediaImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const total = images.length;

  if (total === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border-[length:var(--border-width)] border-border bg-surface-2 px-6 text-center text-sm text-text-muted">
        Este producto todavía no tiene fotos.
      </div>
    );
  }

  const current = images[Math.min(index, total - 1)];

  const moveTo = (next: number, focus = false) => {
    const bounded = ((next % total) + total) % total;
    setIndex(bounded);
    if (focus) buttonsRef.current[bounded]?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border-[length:var(--border-width)] border-border bg-surface-2">
        <StoreImage
          image={current}
          sizes="(min-width: 1024px) 46vw, 100vw"
          priority
        />
      </div>

      {total > 1 ? (
        <div
          role="group"
          aria-label="Fotos del producto"
          className="grid grid-cols-5 gap-2"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              moveTo(index + 1, true);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveTo(index - 1, true);
            } else if (event.key === "Home") {
              event.preventDefault();
              moveTo(0, true);
            } else if (event.key === "End") {
              event.preventDefault();
              moveTo(total - 1, true);
            }
          }}
        >
          {images.map((image, imageIndex) => {
            const active = imageIndex === index;
            return (
              <button
                key={image.id}
                ref={(node) => {
                  buttonsRef.current[imageIndex] = node;
                }}
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-pressed={active}
                aria-label={`Ver foto ${imageIndex + 1} de ${total}: ${productName}`}
                className={cn(
                  "aspect-square overflow-hidden rounded-md border-[length:var(--border-width)] bg-surface-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
                  active ? "border-primary" : "border-border hover:border-border-strong",
                )}
              >
                <img
                  src={image.thumbUrl}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        Foto {index + 1} de {total}
      </p>
    </div>
  );
}
