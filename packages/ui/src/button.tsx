import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Variantes con tokens semánticos (PLAN §10.2 / §10.8). Ninguna variante usa
 * un hex: el tema las reescribe vía CSS variables.
 *
 * Accesibilidad:
 * - 44px de alto mínimo en móvil (`h-11`) y densidad reducida desde `sm`.
 * - Foco visible con `--color-ring` (3:1 sobre el fondo en los 5 temas).
 * - Hover, active y disabled explícitos; `cursor-pointer` en lo clicable.
 * - `size="icon"` exige siempre un `aria-label` en el consumidor.
 */
export const buttonVariants = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius-button,var(--radius-md))] font-body font-medium select-none",
    "border-[length:var(--border-width)] border-transparent",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)]",
        secondary:
          "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)]",
        subtle:
          "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)]",
        ghost:
          "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)]",
        danger:
          "bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:opacity-90 active:opacity-95",
        whatsapp:
          "bg-[var(--color-whatsapp)] text-[var(--color-on-whatsapp)] hover:opacity-90 active:opacity-95",
        link: "border-transparent bg-transparent text-[var(--color-primary)] underline underline-offset-4 hover:text-[var(--color-primary-hover)]",
      },
      size: {
        sm: "h-11 px-3 text-sm sm:h-9",
        md: "h-11 px-4 text-sm sm:h-10",
        lg: "h-12 px-6 text-base",
        icon: "size-11 p-0 sm:size-10",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
