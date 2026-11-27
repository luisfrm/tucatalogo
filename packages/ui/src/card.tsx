import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Semantic card container using theme tokens (`--radius-card`, `--border-width`, `--shadow-*`).
 */
export const cardVariants = cva(
  [
    "rounded-[var(--radius-card,var(--radius-lg))]",
    "border-[length:var(--border-width)] border-[var(--color-border)]",
    "bg-[var(--color-surface)] text-[var(--color-text)]",
    "shadow-[var(--shadow-sm)]",
  ].join(" "),
  {
    variants: {
      interactive: {
        true: "transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]",
        false: "",
      },
      padding: {
        none: "",
        sm: "p-3 sm:p-4",
        md: "p-4 sm:p-5",
        lg: "p-5 sm:p-6",
      },
    },
    defaultVariants: {
      interactive: false,
      padding: "md",
    },
  },
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, interactive, padding, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ interactive, padding }), className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-heading text-base font-semibold tracking-tight text-[var(--color-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[var(--color-text-muted)]", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-3", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
