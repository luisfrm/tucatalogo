import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Semantic badge/pill component using theme tokens.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border-[length:var(--border-width)] px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral:
          "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
        primary:
          "border-transparent bg-[var(--color-primary-subtle)] text-[var(--color-primary)]",
        accent:
          "border-transparent bg-[var(--color-accent)] text-[var(--color-accent-on)]",
        success:
          "border-[var(--color-success)]/40 bg-[var(--color-surface)] text-[var(--color-success)]",
        warning:
          "border-[var(--color-warning)]/50 bg-[var(--color-surface)] text-[var(--color-warning)]",
        danger:
          "border-[var(--color-danger)]/50 bg-[var(--color-surface)] text-[var(--color-danger)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
