import { describe, expect, it } from "vitest";

import {
  homeHref,
  humanizeCategorySlug,
  pageHref,
  productHref,
  readCatalogQuery,
  sanitizeRedirectTarget,
  storeHref,
  totalPages,
} from "../app/lib/urls";

describe("URLs del storefront", () => {
  it("conserva ?siteId en los enlaces internos", () => {
    expect(storeHref("/producto/zapatos", { siteId: "demo" })).toBe(
      "/producto/zapatos?siteId=demo",
    );
    expect(storeHref("/", { siteId: null })).toBe("/");
  });

  it("construye el catálogo con filtros y página", () => {
    expect(homeHref({ category: "zapatos", q: "rojo", siteId: "demo" })).toBe(
      "/?category=zapatos&q=rojo&siteId=demo",
    );
    expect(homeHref({ q: "  ", page: 1 })).toBe("/");
    expect(pageHref(3, { category: "zapatos", q: null, siteId: "demo" })).toBe(
      "/?category=zapatos&page=3&siteId=demo",
    );
  });

  it("codifica el slug del producto", () => {
    expect(productHref("botas-de-cuero")).toBe("/producto/botas-de-cuero");
  });

  it("lee y acota los query params del catálogo", () => {
    const url = new URL("http://demo.localhost:5173/?category= zapatos &q=&page=0");
    expect(readCatalogQuery(url)).toEqual({ category: "zapatos", q: null, page: 1 });

    expect(
      readCatalogQuery(new URL("http://demo.localhost:5173/?q=camisa&page=99999")),
    ).toEqual({ category: null, q: "camisa", page: 10000 });

    expect(readCatalogQuery(new URL("http://demo.localhost:5173/?page=abc")).page).toBe(1);
    expect(readCatalogQuery(new URL("http://demo.localhost:5173/?page=-3")).page).toBe(1);
  });

  it("calcula el total de páginas", () => {
    expect(totalPages(0, 24)).toBe(1);
    expect(totalPages(24, 24)).toBe(1);
    expect(totalPages(25, 24)).toBe(2);
  });

  it("solo acepta redirects relativos del mismo origen", () => {
    expect(sanitizeRedirectTarget("/producto/x?y=1")).toBe("/producto/x?y=1");
    expect(sanitizeRedirectTarget("//evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("https://evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("/ok\r\nSet-Cookie: a=b")).toBe("/");
    expect(sanitizeRedirectTarget(null)).toBe("/");
  });

  it("deriva una etiqueta legible del slug de categoría", () => {
    expect(humanizeCategorySlug("cuidado-facial")).toBe("Cuidado facial");
    expect(humanizeCategorySlug("zapatos")).toBe("Zapatos");
  });
});
