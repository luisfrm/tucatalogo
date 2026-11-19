import { cva, type VariantProps } from "class-variance-authority";
import type { SelectHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Select **nativo** estilizado (sin `@radix-ui/react-select`).
 *
 * Motivos de producto y de plataforma:
 * - Progressive enhancement: los filtros de la tienda viajan en la query
 *   (`GET`) y los formularios del panel en `POST`; el control debe enviar su
 *   `name`/`defaultValue` con `FormData` aunque el JS no haya hidratado.
 * - En móvil abre el picker del sistema (rueda/hoja nativa), que es más
 *   accesible y familiar que un listbox reconstruido.
 * - `appearance-none` + chevron SVG propio: el aspecto lo definen los tokens
 *   del tema, no el user agent.
 *
 * Accesibilidad: 44px de alto mínimo en móvil, 16px de `font-size` en móvil
 * (evita el zoom de iOS), foco visible con `--color-ring`, inválido con
 * `--color-danger` y estado deshabilitado explícito.
 */
export const selectVariants = cva(
  [
    "block w-full cursor-pointer appearance-none",
    "rounded-[var(--radius-md)]",
    "border-[length:var(--border-width)] border-[var(--color-border-strong)]",
    "bg-[var(--color-surface)] text-[var(--color-text)]",
    // Windows/Chrome pintan el desplegable con el fondo del sistema si no se
    // declara: forzamos los tokens del tema para que las opciones sean legibles
    // también en modo oscuro.
    "[&>option]:bg-[var(--color-surface)] [&>option]:text-[var(--color-text)]",
    "transition-[border-color,box-shadow] duration-150 ease-out",
    "hover:border-[var(--color-text-muted)]",
    "focus-visible:border-[var(--color-ring)] focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
    "disabled:cursor-not-allowed disabled:bg-[var(--color-surface-2)] disabled:opacity-60",
    "aria-[invalid=true]:border-[var(--color-danger)]",
    "aria-[invalid=true]:focus-visible:border-[var(--color-danger)]",
    "aria-[invalid=true]:focus-visible:ring-[var(--color-danger)]",
  ].join(" "),
  {
    variants: {
      size: {
        // 16px en móvil: iOS hace zoom al enfocar un control con `font-size`
        // menor de 16px. Desde 640px vuelve a la escala de escritorio.
        // El `pr-*` final reserva el hueco del chevron y gana al `px-*` por
        // orden de utilidades (padding-inline-end se emite después de
        // padding-inline); `cn`/tailwind-merge no lo elimina.
        sm: "h-11 px-3 pr-9 text-base sm:h-9 sm:text-sm",
        md: "h-11 px-3 pr-9 text-base sm:h-10 sm:text-sm",
        lg: "h-12 px-4 pr-10 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {
  /** Marca el campo como inválido (`aria-invalid` + estilos de error). */
  invalid?: boolean;
}

export function Select({
  className,
  invalid = false,
  size,
  ...props
}: SelectProps) {
  return (
    <span className="relative block w-full">
      <select
        aria-invalid={invalid || undefined}
        className={cn(selectVariants({ size }), className)}
        {...props}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        fill="none"
        focusable="false"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
