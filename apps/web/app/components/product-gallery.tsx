import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@tucatalogo/ui";
import type { MediaImage } from "@tucatalogo/types";
import { useRef, useState } from "react";

import { StoreImage } from "./store-image";

/**
 * Product detail image gallery with thumbnail navigation, prev/next controls,
 * and click-to-zoom lightbox dialog.
 */
export function ProductGallery({ images, productName }: { images: MediaImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const total = images.length;

  if (total === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-border bg-surface-2 px-6 text-center text-sm text-text-muted">
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
      <div className="group relative aspect-square overflow-hidden rounded-[var(--radius-card,var(--radius-lg))] border-[length:var(--border-width)] border-border bg-surface-2">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Ampliar imagen ${index + 1} de ${total}: ${productName}`}
          className="h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <StoreImage
            image={current}
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority
          />
        </button>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => moveTo(index - 1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-surface/90 p-2 text-text shadow-sm backdrop-blur transition-opacity hover:bg-surface sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => moveTo(index + 1)}
              aria-label="Siguiente foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-surface/90 p-2 text-text shadow-sm backdrop-blur transition-opacity hover:bg-surface sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{productName}</DialogTitle>
            <DialogDescription>
              Foto {index + 1} de {total}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-2 flex max-h-[75vh] items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
            <img
              src={current.fullUrl}
              alt={current.alt ?? productName}
              className="max-h-[75vh] w-auto object-contain"
            />
          </div>
          {total > 1 ? (
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveTo(index - 1)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
              >
                Anterior
              </button>
              <span className="text-xs text-text-muted tabular-nums">
                {index + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => moveTo(index + 1)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
