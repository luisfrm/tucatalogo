import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--color-border)] bg-[var(--color-surface-2)] p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors",
        "hover:text-[var(--color-text)]",
        "data-[state=active]:bg-[var(--color-surface)] data-[state=active]:text-[var(--color-text)] data-[state=active]:shadow-[var(--shadow-sm)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-3 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
