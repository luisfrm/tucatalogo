import { describe, expect, it } from "vitest";

import {
  buildWhatsappPreview,
  formatMinorForInput,
  moveItem,
  panelFlashMessage,
  parsePriceToMinor,
  readPanelProductsQuery,
  readResetToken,
  safePanelRedirect,
  slugifyCatalogName,
  withFlash,
  whatsappTemplateUsesPlaceholders,
} from "../app/lib/panel";
import { panelHref } from "../app/lib/urls";

describe("precio → unidad mínima", () => {
  it("acepta coma y punto decimal en las monedas del MVP", () => {
    expect(parsePriceToMinor("12,99", "USD")).toEqual({ ok: true, value: 1299 });
    expect(parsePriceToMinor("12.99", "EUR")).toEqual({ ok: true, value: 1299 });
    expect(parsePriceToMinor("49", "COP")).toEqual({ ok: true, value: 4900 });
    expect(parsePriceToMinor("0", "VES")).toEqual({ ok: true, value: 0 });
    expect(parsePriceToMinor(" 1 234,50 ", "ARS")).toEqual({ ok: true, value: 123450 });
  });

  it("interpreta la agrupación de miles sin confundirla con decimales", () => {
    expect(parsePriceToMinor("1.234", "COP")).toEqual({ ok: true, value: 123400 });
    expect(parsePriceToMinor("1.234,56", "EUR")).toEqual({ ok: true, value: 123456 });
    expect(parsePriceToMinor("1,234.56", "USD")).toEqual({ ok: true, value: 123456 });
    expect(parsePriceToMinor("12.345", "COP")).toEqual({ ok: true, value: 1234500 });
  });

  it("rechaza entradas ambiguas, negativas o con demasiados decimales", () => {
    expect(parsePriceToMinor("", "USD").ok).toBe(false);
    expect(parsePriceToMinor("-4,00", "USD").ok).toBe(false);
    expect(parsePriceToMinor("12,9999", "USD").ok).toBe(false);
    expect(parsePriceToMinor("abc", "USD").ok).toBe(false);
    expect(parsePriceToMinor("1,2,3", "USD").ok).toBe(false);
    expect(parsePriceToMinor("1000001", "USD").ok).toBe(false);
  });

  it("devuelve el valor decimal editable sin símbolo de moneda", () => {
    expect(formatMinorForInput(1299, "USD")).toBe("12.99");
    expect(formatMinorForInput(123400, "COP")).toBe("1234.00");
    expect(formatMinorForInput(0, "EUR")).toBe("0.00");
  });
});

describe("slug de producto/categoría", () => {
  it("normaliza acentos, espacios y mayúsculas", () => {
    expect(slugifyCatalogName("Zapatos de Niña")).toBe("zapatos-de-nina");
    expect(slugifyCatalogName("  Sandalias 2026  ")).toBe("sandalias-2026");
    expect(slugifyCatalogName("Bolso — edición limitada")).toBe("bolso-edicion-limitada");
  });

  it("recorta a 63 caracteres sin guion final", () => {
    const slug = slugifyCatalogName("a".repeat(80));
    expect(slug.length).toBeLessThanOrEqual(63);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("devuelve vacío si no queda ningún carácter válido", () => {
    expect(slugifyCatalogName("¡¡¡!!!")).toBe("");
  });
});

describe("plantilla de WhatsApp", () => {
  const base = {
    number: "584141234567",
    template: "¡Hola {tienda}! Me interesa {producto} ({precio}).",
    productName: "Zapatos rojos",
    priceLabel: "49,90 US$",
    storeName: "QA Store",
  };

  it("sustituye las tres variables y codifica el texto", () => {
    const url = buildWhatsappPreview(base);
    expect(url).toContain("https://wa.me/584141234567?text=");
    const text = decodeURIComponent(url!.split("text=")[1]!);
    expect(text).toBe("¡Hola QA Store! Me interesa Zapatos rojos (49,90 US$).");
  });

  it("sin número válido no inventa un enlace", () => {
    expect(buildWhatsappPreview({ ...base, number: "" })).toBeNull();
    expect(buildWhatsappPreview({ ...base, number: "+584141234567" })).toBeNull();
    expect(buildWhatsappPreview({ ...base, number: "123" })).toBeNull();
  });

  it("detecta si la plantilla usa variables", () => {
    expect(whatsappTemplateUsesPlaceholders(base.template)).toBe(true);
    expect(whatsappTemplateUsesPlaceholders("Hola, quiero comprar")).toBe(false);
  });
});

describe("consultas y URLs del panel", () => {
  it("lee filtros sin confiar en valores raros", () => {
    const url = new URL("https://qa-store.localhost/panel-admin/productos?q=%20zapatos%20&status=active&page=3");
    expect(readPanelProductsQuery(url)).toEqual({
      q: "zapatos",
      category: "",
      status: "active",
      page: 3,
    });

    const invalid = new URL("https://qa-store.localhost/panel-admin/productos?status=otro&page=-9");
    expect(readPanelProductsQuery(invalid)).toEqual({
      q: "",
      category: "",
      status: "all",
      page: 1,
    });
  });

  it("construye enlaces internos conservando siteId", () => {
    expect(panelHref("")).toBe("/panel-admin");
    expect(panelHref("productos")).toBe("/panel-admin/productos");
    expect(panelHref("productos/nuevo", { siteId: "qa-store" })).toBe(
      "/panel-admin/productos/nuevo?siteId=qa-store",
    );
  });

  it("solo acepta redirects internos del panel", () => {
    expect(safePanelRedirect("/panel-admin/productos?page=2")).toBe("/panel-admin/productos?page=2");
    expect(safePanelRedirect("https://evil.test/panel-admin")).toBe("/panel-admin");
    expect(safePanelRedirect("//evil.test/panel-admin")).toBe("/panel-admin");
    expect(safePanelRedirect("/panel-admin/../api")).toBe("/panel-admin");
    expect(safePanelRedirect("javascript:alert(1)")).toBe("/panel-admin");
  });

  it("añade el flash conservando filtros", () => {
    const url = new URL("https://qa-store.localhost/panel-admin/productos?q=zapatos&page=2");
    expect(withFlash(url, "product-deleted")).toBe(
      "/panel-admin/productos?q=zapatos&page=2&ok=product-deleted",
    );
  });

  it("mapea códigos de éxito y descarta los desconocidos", () => {
    expect(panelFlashMessage("product-created")).toContain("Producto creado");
    expect(panelFlashMessage("no-existe")).toBeNull();
    expect(panelFlashMessage(null)).toBeNull();
  });
});

describe("rutas de reset", () => {
  it("mantiene el token solo en el query y lo ignora si falta", () => {
    const url = new URL("https://qa-store.localhost/panel-admin/reset-password?token=abc123");
    expect(readResetToken(url)).toBe("abc123");
    expect(readResetToken(new URL("https://qa-store.localhost/panel-admin/reset-password"))).toBeNull();
    expect(
      readResetToken(new URL(`https://qa-store.localhost/x?token=${"a".repeat(600)}`)),
    ).toBeNull();
  });

  it("el path oficial del API y el alias apuntan al mismo flujo", () => {
    expect(panelHref("reset-password")).toBe("/panel-admin/reset-password");
    expect(panelHref("restablecer")).toBe("/panel-admin/restablecer");
  });
});

describe("reordenamiento", () => {
  it("mueve arriba/abajo sin mutar el original", () => {
    const ids = ["a", "b", "c"];
    expect(moveItem(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(ids, "b", "down")).toEqual(["a", "c", "b"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("devuelve null en los extremos o con ids desconocidos", () => {
    expect(moveItem(["a", "b"], "a", "up")).toBeNull();
    expect(moveItem(["a", "b"], "b", "down")).toBeNull();
    expect(moveItem(["a", "b"], "z", "up")).toBeNull();
  });
});
