import { describe, expect, it } from "vitest";

import { buttonVariants } from "../src/button";
import { badgeVariants } from "../src/badge";
import { cardVariants } from "../src/card";
import { inputVariants } from "../src/input";
import { selectVariants } from "../src/select";
import { textareaVariants } from "../src/textarea";

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

  it("mantiene 16px en móvil para evitar el zoom de iOS", () => {
    for (const size of ["sm", "md"] as const) {
      const classes = inputVariants({ size });
      expect(classes, size).toContain("text-base");
      expect(classes, size).toContain("sm:text-sm");
    }

    // `lg` ya vive en 16px: no debe arrastrar un salto en `sm:`.
    const large = inputVariants({ size: "lg" });
    expect(large).toContain("text-base");
    expect(large).not.toContain("sm:text-sm");
  });
});

describe("Select", () => {
  it("usa tokens y no hex (select nativo estilizado)", () => {
    const classes = selectVariants();
    expect(classes).not.toMatch(HEX_PATTERN);
    expect(classes).toContain("var(--color-");
    expect(classes).toContain("appearance-none");
    expect(classes).toContain("var(--color-border-strong)");
    expect(classes).toContain("var(--radius-md)");
  });

  it("declara hover, foco, inválido y disabled", () => {
    const classes = selectVariants();
    expect(classes).toContain("hover:border-");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("var(--color-ring)");
    expect(classes).toContain("aria-[invalid=true]:border-[var(--color-danger)]");
    expect(classes).toContain("disabled:opacity-60");
  });

  it("reserva el hueco del chevron y deja las opciones legibles", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      expect(selectVariants({ size }), size).toMatch(/\bpr-(9|10)\b/);
    }
    expect(selectVariants()).toContain("[&>option]:bg-[var(--color-surface)]");
    expect(selectVariants()).toContain("[&>option]:text-[var(--color-text)]");
  });

  it("cumple 44px de alto mínimo en móvil", () => {
    for (const size of ["sm", "md"] as const) {
      expect(selectVariants({ size }), size).toContain("h-11");
    }
    expect(selectVariants({ size: "lg" })).toContain("h-12");
  });

  it("mantiene 16px en móvil para evitar el zoom de iOS", () => {
    for (const size of ["sm", "md"] as const) {
      const classes = selectVariants({ size });
      expect(classes, size).toContain("text-base");
      expect(classes, size).toContain("sm:text-sm");
    }

    const large = selectVariants({ size: "lg" });
    expect(large).toContain("text-base");
    expect(large).not.toContain("sm:text-sm");
  });
});

describe("Card, Badge y Textarea", () => {
  it("Card usa tokens semánticos sin hex", () => {
    const classes = cardVariants({ interactive: true });
    expect(classes).not.toMatch(HEX_PATTERN);
    expect(classes).toContain("var(--color-surface)");
    expect(classes).toContain("var(--shadow-sm)");
    expect(classes).toContain("var(--shadow-md)");
  });

  it("Badge usa tokens semánticos en todas sus variantes", () => {
    for (const variant of ["neutral", "primary", "accent", "success", "warning", "danger"] as const) {
      const classes = badgeVariants({ variant });
      expect(classes, variant).not.toMatch(HEX_PATTERN);
      expect(classes).toContain("var(--color-");
    }
  });

  it("Textarea mantiene 16px en móvil y tokens de foco/invalidez", () => {
    const classes = textareaVariants();
    expect(classes).not.toMatch(HEX_PATTERN);
    expect(classes).toContain("text-base");
    expect(classes).toContain("sm:text-sm");
    expect(classes).toContain("var(--color-ring)");
    expect(classes).toContain("aria-[invalid=true]:border-[var(--color-danger)]");
  });
});
