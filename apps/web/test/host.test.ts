import { describe, expect, it } from "vitest";

import { resolveStoreSlug } from "../app/lib/host";

describe("resolución de host del storefront", () => {
  const SUBZONE = "tucatalogo.luisrivas.site";

  it("extrae el slug del subdominio de la subzona de tiendas", () => {
    expect(resolveStoreSlug("mi-tienda.tucatalogo.luisrivas.site", SUBZONE)).toEqual({
      slug: "mi-tienda",
      reason: "ok",
      siteId: null,
    });
  });

  it("no trata la raíz ni www de la subzona como tienda", () => {
    expect(resolveStoreSlug(SUBZONE, SUBZONE).reason).toBe("root");
    expect(resolveStoreSlug(`www.${SUBZONE}`, SUBZONE).reason).toBe("root");
  });

  it("rechaza hosts reservados, anidados y de otro dominio", () => {
    expect(resolveStoreSlug(`admin.${SUBZONE}`, SUBZONE).reason).toBe("reserved");
    expect(resolveStoreSlug(`panel.${SUBZONE}`, SUBZONE).reason).toBe("reserved");
    // El dominio padre no es una tienda: `mi-tienda.luisrivas.site` no existe
    // por diseño (no hay comodín en luisrivas.site).
    expect(resolveStoreSlug("mi-tienda.luisrivas.site", SUBZONE).reason).toBe("invalid");
    expect(resolveStoreSlug("console-tucatalogo.luisrivas.site", SUBZONE).reason).toBe("invalid");
    expect(resolveStoreSlug(`a.b.${SUBZONE}`, SUBZONE).reason).toBe("invalid");
    expect(resolveStoreSlug("otro-dominio.com", SUBZONE).reason).toBe("invalid");
    expect(resolveStoreSlug(`Bad_Slug.${SUBZONE}`, SUBZONE).reason).toBe("invalid");
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
