/**
 * Marca de TuCatálogo: el monograma "TC" de las superficies de marca
 * (`commercial` y `console`).
 *
 * Se dibuja como geometría (`rect` + anillo abierto), no como texto: no
 * depende de que ninguna fuente cargue, y a 24–32 px mantiene el contraste de
 * astas que un `<text>` del sistema pierde. El mismo dibujo está en
 * `assets/brand/mark.svg` (generado por `scripts/brand/build.mjs`); el test
 * `packages/ui/test/brand-mark.test.tsx` falla si los dos se separan.
 *
 * Hereda `currentColor`, así que el color lo pone la superficie:
 * `text-on-primary` sobre la teja del CTA en la landing, `text-primary` sobre
 * la teja de papel en el console.
 */
export const BRAND_MARK_VIEWBOX = 32;

/** Teja cuadrada: 25 % de radio, el mismo que `--radius-md` sobre 2.5rem. */
export const BRAND_MARK_TILE_RADIUS = 8;

/** Asta del monograma y caja de la mayúscula, en unidades de la retícula. */
export const BRAND_MARK_STROKE = 3.7;

export const BRAND_MARK_GLYPH = [
  { kind: "rect", x: 3.2, y: 8.3, width: 7.8, height: 3.7 },
  { kind: "rect", x: 5.25, y: 8.3, width: 3.7, height: 15.4 },
  {
    kind: "path",
    d: "M25.64 22.07A7.7 7.7 0 1 1 25.64 9.93L23.36 12.85A4 4 0 1 0 23.36 19.15Z",
  },
] as const;

export interface BrandMarkProps {
  /** Clases del contenedor; el tamaño se controla aquí (`size-6`). */
  className?: string;
  /** Nombre accesible. Sin él, la marca es decorativa (`aria-hidden`). */
  title?: string;
}

export function BrandMark({ className, title }: BrandMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox={`0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}`}
      className={className}
      fill="currentColor"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled ? <title>{title}</title> : null}
      {BRAND_MARK_GLYPH.map((shape) =>
        shape.kind === "rect" ? (
          <rect
            key={`${shape.x}-${shape.y}`}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
          />
        ) : (
          <path key={shape.d} d={shape.d} />
        ),
      )}
    </svg>
  );
}
