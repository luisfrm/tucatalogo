import { cn } from "@tucatalogo/ui";
import type { MediaImage } from "@tucatalogo/types";

/**
 * Imagen del catálogo con dimensiones explícitas y `srcset` full/thumb
 * (PLAN §9.6). El thumb se genera a 600 px de ancho máximo, así que su
 * descriptor real es `min(600, ancho del full)`.
 */
export interface StoreImageProps {
  image: MediaImage;
  sizes: string;
  /** Primera imagen del viewport: sin lazy y con prioridad alta. */
  priority?: boolean;
  className?: string;
}

export function StoreImage({ image, sizes, priority = false, className }: StoreImageProps) {
  const thumbWidth = Math.min(600, image.width);

  return (
    <img
      src={image.thumbUrl}
      srcSet={`${image.thumbUrl} ${thumbWidth}w, ${image.fullUrl} ${image.width}w`}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
