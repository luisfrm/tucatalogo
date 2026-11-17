import { describe, expect, it } from "vitest";

import { resolveStoreSlug } from "../app/lib/host";

describe("resolución de host del storefront", () => {
  it("extrae el slug de un subdominio directo", () => {
    expect(resolveStoreSlug("mi-tienda.luisrivas.site", "luisrivas.site")).toEqual({
      slug: "mi-tienda",
      reason: "ok",
      siteId: null,
    });
  });

  it("no trata el ápice ni www como tienda", () => {
    expect(resolveStoreSlug("luisrivas.site", "luisrivas.site").reason).toBe("root");
    expect(resolveStoreSlug("www.luisrivas.site", "luisrivas.site").reason).toBe("root");
  });

  it("rechaza hosts reservados, anidados y de otro dominio", () => {
    expect(resolveStoreSlug("tucatalogo.luisrivas.site", "luisrivas.site").reason).toBe("reserved");
    expect(resolveStoreSlug("console-tucatalogo.luisrivas.site", "luisrivas.site").reason).toBe(
      "reserved",
    );
    expect(resolveStoreSlug("a.b.luisrivas.site", "luisrivas.site").reason).toBe("invalid");
    expect(resolveStoreSlug("otro-dominio.com", "luisrivas.site").reason).toBe("invalid");
    expect(resolveStoreSlug("Bad_Slug.luisrivas.site", "luisrivas.site").reason).toBe("invalid");
  });

  it("acepta el subdominio local de una tienda", () => {
    expect(resolveStoreSlug("demo.localhost:5173", "localhost")).toEqual({
      slug: "demo",
      reason: "ok",
      siteId: null,
    });
    expect(resolveStoreSlug("localhost:5173", "localhost").reason).toBe("root");
  });

  it("usa ?siteId solo cuando el entorno lo permite", () => {
    expect(
      resolveStoreSlug("localhost", "localhost", { siteId: " Mi-Tienda ", allowSiteId: true }),
    ).toEqual({ slug: "mi-tienda", reason: "site-id", siteId: "mi-tienda" });

    expect(
      resolveStoreSlug("localhost", "localhost", { siteId: "mi-tienda", allowSiteId: false }),
    ).toEqual({ slug: null, reason: "site-id-forbidden", siteId: null });
  });

  it("rechaza siteId inválido o reservado", () => {
    expect(
      resolveStoreSlug("localhost", "localhost", { siteId: "no vale", allowSiteId: true }).reason,
    ).toBe("site-id-invalid");
    expect(
      resolveStoreSlug("localhost", "localhost", { siteId: "admin", allowSiteId: true }).reason,
    ).toBe("reserved");
  });

  it("ignora un siteId vacío (vale el host)", () => {
    expect(
      resolveStoreSlug("demo.localhost", "localhost", { siteId: "  ", allowSiteId: false }),
    ).toEqual({ slug: "demo", reason: "ok", siteId: null });
  });
});
