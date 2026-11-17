import { describe, expect, it } from "vitest";

import { formatPriceMinor, minorUnitsToMajor } from "../src/libs/price";

describe("precios en unidad mínima", () => {
  it("convierte a unidad mayor con el exponente de la moneda", () => {
    expect(minorUnitsToMajor(1999, "USD")).toBe(19.99);
    expect(minorUnitsToMajor(50000, "COP")).toBe(500);
  });

  it("formatea con el locale pedido", () => {
    expect(formatPriceMinor(1999, "USD", "en-US")).toBe("$19.99");
    expect(formatPriceMinor(1999, "EUR", "es-ES")).toContain("19,99");
  });
});
