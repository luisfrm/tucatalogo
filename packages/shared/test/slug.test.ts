import { describe, expect, it } from "vitest";

import { getSlugRejectionReason, normalizeSlugInput } from "../src/libs/slug";
import { RESERVED_SLUGS, isReservedSlug } from "../src/constants/reserved-slugs";

describe("slugs", () => {
  it("contiene los reservados del plan", () => {
    for (const slug of ["www", "api", "tucatalogo", "tucatalogo-bucket"]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
    expect(RESERVED_SLUGS).toHaveLength(15);
    expect(isReservedSlug("mi-tienda")).toBe(false);
  });

  it("clasifica entradas inválidas", () => {
    expect(getSlugRejectionReason("")).toBe("empty");
    expect(getSlugRejectionReason("Mi Tienda")).toBe("format");
    expect(getSlugRejectionReason("mi-tienda-")).toBe("format");
    expect(getSlugRejectionReason("console")).toBe("reserved");
    expect(getSlugRejectionReason("mi-tienda")).toBeNull();
  });

  it("normaliza sin inventar valores", () => {
    expect(normalizeSlugInput("  Mi-Tienda  ")).toBe("mi-tienda");
    expect(normalizeSlugInput("")).toBe("");
  });
});
