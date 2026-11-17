import { describe, expect, it } from "vitest";

import type { OwnerDraft, SlugStatus } from "../app/features/signup/types";
import {
  firstErrorField,
  OWNER_FIELD_ORDER,
  validateOtpCode,
  validateOtpRequest,
  validateOwnerDraft,
  validateThemeStep,
} from "../app/features/signup/validation";

const AVAILABLE: SlugStatus = {
  kind: "available",
  slug: "mi-tienda",
  storefront: "https://mi-tienda.luisrivas.site",
  panel: "https://mi-tienda.luisrivas.site/panel-admin",
};

const DRAFT: OwnerDraft = {
  name: "Ana Pérez",
  email: "Ana@Example.com ",
  password: "contrasena-segura",
  passwordConfirm: "contrasena-segura",
  storeName: "Tienda de Ana",
  slug: "mi-tienda",
  currency: "EUR",
  acceptedTerms: true,
};

function withDraft(patch: Partial<OwnerDraft>, slugStatus: SlugStatus = AVAILABLE) {
  return validateOwnerDraft({ ...DRAFT, ...patch }, slugStatus);
}

describe("paso 1 · datos del dueño y de la tienda", () => {
  it("acepta un formulario completo con el slug disponible", () => {
    expect(validateOwnerDraft(DRAFT, AVAILABLE)).toEqual({});
  });

  it("exige nombre y nombre de tienda", () => {
    expect(withDraft({ name: "A" }).name).toBeDefined();
    expect(withDraft({ storeName: " " }).storeName).toBeDefined();
  });

  it("valida el email", () => {
    expect(withDraft({ email: "ana@" }).email).toBeDefined();
  });

  it("exige contraseña de al menos 8 caracteres", () => {
    expect(withDraft({ password: "corta", passwordConfirm: "corta" }).password).toBeDefined();
  });

  it("exige que las contraseñas coincidan", () => {
    expect(withDraft({ passwordConfirm: "otra-cosa" }).passwordConfirm).toBe(
      "Las contraseñas no coinciden.",
    );
  });

  it("rechaza formatos de slug inválidos", () => {
    expect(withDraft({ slug: "Mi-Tienda" }, { kind: "idle" }).slug).toContain("Solo minúsculas");
  });

  it("exige que el slug esté comprobado como disponible", () => {
    expect(withDraft({}, { kind: "idle" }).slug).toBe(
      "Comprueba que el identificador esté disponible.",
    );
    expect(withDraft({}, { kind: "checking" }).slug).toBeDefined();
  });

  it("propaga el motivo cuando el slug no está disponible", () => {
    const errors = withDraft({}, {
      kind: "unavailable",
      slug: "mi-tienda",
      message: "Ese identificador ya está en uso. Prueba con otro.",
    });
    expect(errors.slug).toBe("Ese identificador ya está en uso. Prueba con otro.");
  });

  it("ignora una comprobación de otro slug", () => {
    const errors = withDraft(
      { slug: "otra-tienda" },
      { ...AVAILABLE, slug: "mi-tienda" },
    );
    expect(errors.slug).toBe("Comprueba que el identificador esté disponible.");
  });

  it("exige moneda y aceptación de legales", () => {
    expect(withDraft({ currency: "" }).currency).toBe(
      "Elige la moneda con la que venderás.",
    );
    expect(withDraft({ acceptedTerms: false }).terms).toBe(
      "Debes aceptar los términos y el aviso de privacidad.",
    );
  });
});

describe("paso 2 · tema", () => {
  const ids = ["rose", "nude-studio"];

  it("exige un tema de la lista", () => {
    expect(validateThemeStep(null, ids).theme).toBe("Elige un tema para continuar.");
    expect(validateThemeStep("otro", ids).theme).toBeDefined();
  });

  it("acepta un tema implementado", () => {
    expect(validateThemeStep("rose", ids)).toEqual({});
  });
});

describe("paso 3 · verificación", () => {
  it("exige el token anti-bot antes de pedir el código", () => {
    expect(validateOtpRequest(null).turnstileToken).toBeDefined();
    expect(validateOtpRequest("token")).toEqual({});
  });

  it("exige exactamente 6 dígitos", () => {
    expect(validateOtpCode("12345").code).toBe("El código tiene 6 dígitos.");
    expect(validateOtpCode("12345a").code).toBeDefined();
    expect(validateOtpCode("123456")).toEqual({});
  });
});

describe("orden de los errores", () => {
  it("devuelve el primer campo según el orden visual", () => {
    expect(
      firstErrorField({ email: "x", name: "y" }, OWNER_FIELD_ORDER),
    ).toBe("name");
  });

  it("cae al primer error restante si no está en el orden", () => {
    expect(firstErrorField({ terms: "z" }, OWNER_FIELD_ORDER)).toBe("terms");
    expect(firstErrorField({}, OWNER_FIELD_ORDER)).toBeNull();
  });
});
