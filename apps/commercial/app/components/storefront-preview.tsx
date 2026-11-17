/**
 * Mock de home de tienda para las previews reales de `packages/themes`.
 *
 * No inventa tokens: todo sale de las CSS variables que el bloque
 * `[data-theme="…"]` define en el `<head>` (PLAN §10.5). Al ser un mock
 * decorativo, el contenedor va `aria-hidden` y la información accesible vive
 * en la tarjeta que lo envuelve.
 */
const PRODUCTS = [
  { name: "Blusa de lino", price: "US$ 24,99", art: 0 },
  { name: "Sandalia trenzada", price: "US$ 39,50", art: 1 },
] as const;

function ProductArt({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-8 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {index === 0 ? (
        <>
          <path d="M18 13h12l-1.5 6 4.5 17H15l4.5-17z" />
          <path d="M20 13a4 4 0 0 1 8 0" />
        </>
      ) : (
        <>
          <path d="M12 33h24v4H12z" />
          <path d="M17 33c0-7 4-12 11-12h2l6 12" />
        </>
      )}
    </svg>
  );
}

export interface StorefrontPreviewProps {
  /** Id de un tema implementado (`rose`, `nude-studio`, …). */
  themeId: string;
  className?: string;
}

export function StorefrontPreview({ themeId, className }: StorefrontPreviewProps) {
  return (
    <div
      data-theme={themeId}
      data-color-mode="light"
      aria-hidden="true"
      className={[
        "flex flex-col overflow-hidden bg-bg font-body text-text",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="font-heading text-[11px] font-semibold tracking-tight">
          Mi Tienda
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] text-text-muted">
          Catálogo
        </span>
      </div>

      <div className="bg-primary-subtle px-3 py-3.5">
        <p className="font-heading text-[13px] leading-tight font-semibold">
          Nueva colección
        </p>
        <p className="mt-0.5 text-[9px] text-text-muted">Piezas hechas para ti</p>
        <span className="mt-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-[9px] font-medium text-on-primary">
          Ver todo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2">
        {PRODUCTS.map((product) => (
          <article
            key={product.name}
            className="overflow-hidden rounded-md border border-border bg-surface shadow-sm"
          >
            <div className="grid aspect-square place-items-center bg-surface-2 text-text-muted">
              <ProductArt index={product.art} />
            </div>
            <div className="space-y-1 px-2 py-1.5">
              <p className="text-[10px] leading-tight font-medium">{product.name}</p>
              <p className="text-[10px] font-semibold text-price">{product.price}</p>
              <span className="inline-flex rounded-full bg-whatsapp px-1.5 py-0.5 text-[8px] font-medium text-on-whatsapp">
                Pedir por WhatsApp
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
