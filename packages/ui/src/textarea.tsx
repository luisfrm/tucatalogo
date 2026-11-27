import { cva, type VariantProps } from "class-variance-authority";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Multi-line textarea matching Input styling and 16px mobile font-size to prevent iOS zoom.
 */
export const textareaVariants = cva(
  [
    "block w-full rounded-[var(--radius-md)]",
    "border-[length:var(--border-width)] border-[var(--color-border-strong)]",
    "bg-[var(--color-surface)] px-3 py-2 font-body text-base text-[var(--color-text)] sm:text-sm",
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
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  invalid?: boolean;
}

export function Textarea({
  className,
  invalid = false,
  ...props
}: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(textareaVariants(), className)}
      {...props}
    />
  );
}
