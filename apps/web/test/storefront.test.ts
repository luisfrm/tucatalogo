import { describe, expect, it } from "vitest";

import {
  parseColorModeCookie,
  resolveColorMode,
  serializeColorModeCookie,
  toggleColorMode,
} from "../app/lib/color-mode";
import { formatStorePrice, priceDecimal } from "../app/lib/price";
import { resolveWhatsappLink } from "../app/lib/whatsapp";

describe("modo claro/oscuro", () => {
  it("claro por defecto cuando no hay cookie", () => {
    expect(parseColorModeCookie(null)).toBeNull();
    expect(resolveColorMode({ cookieHeader: null, storeDefault: "light" })).toBe("light");
  });

  it("lee la cookie host-only y cae al default de la tienda", () => {
    expect(parseColorModeCookie("otra=1; color_mode=dark; x=y")).toBe("dark");
    expect(resolveColorMode({ cookieHeader: "color_mode=light", storeDefault: "dark" })).toBe(
      "light",
    );
    expect(resolveColorMode({ cookieHeader: "color_mode=dark", storeDefault: "light" })).toBe(
      "dark",
    );
  });

  it("ignora valores desconocidos o corruptos de la cookie", () => {
    expect(parseColorModeCookie("color_mode=neon")).toBeNull();
    expect(parseColorModeCookie("color_mode=%E0%A4%A")).toBeNull();
    expect(resolveColorMode({ cookieHeader: "color_mode=neon", storeDefault: "dark" })).toBe("dark");
  });

  it("serializa una cookie host-only (sin Domain) y con Secure opcional", () => {
    const cookie = serializeColorModeCookie("dark");
    expect(cookie).toContain("color_mode=dark");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Domain=");

    expect(serializeColorModeCookie("light", { secure: true })).toContain("Secure");
  });

  it("alterna el modo", () => {
    expect(toggleColorMode("light")).toBe("dark");
    expect(toggleColorMode("dark")).toBe("light");
  });
});

describe("precio y WhatsApp", () => {
  it("formatea con la moneda de la tienda, sin conversión", () => {
    // Intl usa espacio duro (U+00A0) entre importe y moneda.
    expect(formatStorePrice(1299, "USD")).toBe("12,99\u00A0US$");
    expect(formatStorePrice(2599, "EUR")).toBe("25,99\u00A0€");
    expect(formatStorePrice(129900, "COP")).toBe("1299,00\u00A0COP");
  });

  it("entrega el precio decimal de schema.org en la unidad mínima correcta", () => {
    expect(priceDecimal(1299, "USD")).toBe("12.99");
    expect(priceDecimal(129900, "COP")).toBe("1299.00");
  });

  it("usa la URL de WhatsApp del API y la oculta si no es wa.me", () => {
    const url = "https://wa.me/584141234567?text=Hola%20tienda";
    expect(resolveWhatsappLink(url)).toBe(url);
    expect(resolveWhatsappLink(null)).toBeNull();
    expect(resolveWhatsappLink("")).toBeNull();
    expect(resolveWhatsappLink("http://wa.me/584141234567")).toBeNull();
    expect(resolveWhatsappLink("https://example.com/wa.me")).toBeNull();
    expect(resolveWhatsappLink("javascript:alert(1)")).toBeNull();
  });
});
