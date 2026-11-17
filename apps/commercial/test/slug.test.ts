import { describe, expect, it } from "vitest";

import { panelLoginPath, slugDomain, toSlugDraft } from "../app/features/signup/slug";

describe("normalización del identificador de tienda", () => {
  it("pasa a minúsculas y quita acentos y espacios", () => {
    expect(toSlugDraft("  Mi Tienda Ñandú  ")).toBe("mi-tienda-nandu");
  });

  it("convierte separadores en guiones y colapsa los repetidos", () => {
    expect(toSlugDraft("sol_de   verano")).toBe("sol-de-verano");
  });

  it("no deja guiones al principio ni al final", () => {
    expect(toSlugDraft("--hola--")).toBe("hola");
  });

  it("mantiene números y descarta el resto de símbolos", () => {
    expect(toSlugDraft("tienda#2026!")).toBe("tienda-2026");
  });

  it("recorta a 63 caracteres y no termina en guion", () => {
    const result = toSlugDraft("a".repeat(62) + " b");
    expect(result.length).toBeLessThanOrEqual(63);
    expect(result.endsWith("-")).toBe(false);
  });

  it("un texto sin caracteres válidos queda vacío (lo rechaza la validación)", () => {
    expect(toSlugDraft("¡¡¡")).toBe("");
  });
});

describe("enlace público de la tienda", () => {
  it("compone slug + dominio", () => {
    expect(slugDomain("mi-tienda", "luisrivas.site")).toBe("mi-tienda.luisrivas.site");
  });

  it("muestra un ejemplo cuando aún no hay slug", () => {
    expect(slugDomain("", "luisrivas.site")).toBe("tu-tienda.luisrivas.site");
  });

  it("no duplica barras al construir el login del panel", () => {
    expect(panelLoginPath("https://mi-tienda.luisrivas.site/panel-admin/")).toBe(
      "https://mi-tienda.luisrivas.site/panel-admin/login",
    );
  });
});
