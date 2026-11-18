import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Input con tokens semánticos y estados completos:
 * reposo, hover, foco (`--color-ring`), inválido (`--color-danger`) y
 * deshabilitado. 44px de alto mínimo en móvil.
 */
export const inputVariants = cva(
  [
    "block w-full rounded-[var(--radius-md)]",
    "border-[length:var(--border-width)] border-[var(--color-border-strong)]",
    "bg-[var(--color-surface)] text-[var(--color-text)]",
    "placeholder:text-[var(--color-text-muted)]",
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
        sm: "h-11 px-3 text-base sm:h-9 sm:text-sm",
        md: "h-11 px-3 text-base sm:h-10 sm:text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Marca el campo como inválido (`aria-invalid` + estilos de error). */
  invalid?: boolean;
}

export function Input({
  className,
  invalid = false,
  size,
  ...props
}: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
