import { describe, expect, it } from "vitest";

import { buttonVariants } from "../src/button";
import { inputVariants } from "../src/input";

const HEX_PATTERN = /#[0-9a-f]{3,8}\b/i;

function classesOf(variants: Parameters<typeof buttonVariants>[0] = {}) {
  return buttonVariants(variants);
}

describe("Button", () => {
  it("todas las variantes usan tokens, nunca hex", () => {
    const variants = [
      "primary",
      "secondary",
      "subtle",
      "ghost",
      "danger",
      "whatsapp",
      "link",
    ] as const;

    for (const variant of variants) {
      const classes = classesOf({ variant });
      expect(classes, variant).not.toMatch(HEX_PATTERN);
      expect(classes).toContain(`var(--color-`);
    }
  });

  it("declara hover, foco y disabled en todas las variantes", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      const classes = classesOf({ variant });
      expect(classes).toContain("hover:");
      expect(classes).toContain("focus-visible:ring-2");
      expect(classes).toContain("var(--color-ring)");
      expect(classes).toContain("disabled:opacity-60");
    }
  });

  it("cumple 44px de alto mínimo en móvil", () => {
    for (const size of ["sm", "md", "lg", "icon"] as const) {
      const classes = classesOf({ size });
      const minHeight =
        size === "lg" ? "h-12" : size === "icon" ? "size-11" : "h-11";
      expect(classes, size).toContain(minHeight);
    }
  });

  it("usa el radio del tema", () => {
    expect(classesOf()).toContain("var(--radius-md)");
  });

  it("permite variantes y tamaño por defecto", () => {
    const classes = classesOf();
    expect(classes).toContain("var(--color-primary)");
    expect(classes).toContain("var(--color-on-primary)");
    expect(classes).toContain("h-11");
  });
});

describe("Input", () => {
  it("usa tokens y estados hover, foco, inválido y disabled", () => {
    const classes = inputVariants();
    expect(classes).not.toMatch(HEX_PATTERN);
    expect(classes).toContain("var(--color-border-strong)");
    expect(classes).toContain("hover:border-");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("var(--color-ring)");
    expect(classes).toContain("aria-[invalid=true]:border-[var(--color-danger)]");
    expect(classes).toContain("disabled:opacity-60");
  });

  it("cumple 44px de alto mínimo en móvil", () => {
    expect(inputVariants()).toContain("h-11");
    expect(inputVariants({ size: "lg" })).toContain("h-12");
  });
});
