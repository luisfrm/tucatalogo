import { describe, expect, it } from "vitest";

import { CURRENCIES } from "@tucatalogo/types";

import {
  CURRENCY_OPTIONS,
  describeApiError,
  OTP_COOLDOWN_SECONDS,
  slugReasonMessage,
} from "../app/features/signup/messages";

describe("mensajes de moneda", () => {
  it("ofrece exactamente las cinco monedas del contrato", () => {
    expect(CURRENCY_OPTIONS.map((option) => option.value)).toEqual([...CURRENCIES]);
  });

  it("cada opción incluye su código ISO", () => {
    for (const option of CURRENCY_OPTIONS) {
      expect(option.label).toContain(option.value);
    }
  });

  it("no inventa una moneda por defecto", () => {
    expect(CURRENCY_OPTIONS.some((option) => option.label.includes("por defecto"))).toBe(
      false,
    );
  });

  it("traduce las monedas a español", () => {
    const labels = Object.fromEntries(
      CURRENCY_OPTIONS.map((option) => [option.value, option.label]),
    );
    expect(labels.COP).toContain("Peso colombiano");
    expect(labels.EUR).toContain("Euro");
    expect(labels.ARS).toContain("Peso argentino");
  });
});

describe("mensajes de la comprobación de slug", () => {
  it("explica cada motivo del API", () => {
    expect(slugReasonMessage("taken")).toContain("ya está en uso");
    expect(slugReasonMessage("reserved")).toContain("reservado");
    expect(slugReasonMessage("quarantined")).toContain("no estará libre");
    expect(slugReasonMessage("format")).toContain("minúsculas");
    expect(slugReasonMessage("empty")).toContain("Escribe");
  });
});

describe("traducción de errores del API", () => {
  it("lleva SLUG_TAKEN al campo slug", () => {
    const described = describeApiError({
      status: 409,
      code: "CONFLICT",
      message: "Ese identificador ya está en uso.",
      reason: "SLUG_TAKEN",
    });

    expect(described.reason).toBe("SLUG_TAKEN");
    expect(described.errors.slug).toBe(described.message);
    expect(described.message).toContain("identificador");
  });

  it("lleva EMAIL_TAKEN al campo email", () => {
    const described = describeApiError({
      status: 409,
      code: "CONFLICT",
      message: "Ese email ya tiene una cuenta.",
      reason: "EMAIL_TAKEN",
    });
    expect(described.errors.email).toBe(described.message);
  });

  it("lleva OTP_EXPIRED al campo del código", () => {
    const described = describeApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "El código caducó.",
      reason: "OTP_EXPIRED",
    });
    expect(described.errors.code).toContain("caducó");
  });

  it("sugiere espera cuando el OTP está en enfriamiento", () => {
    const described = describeApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Espera un momento antes de pedir otro código.",
      reason: "OTP_COOLDOWN",
    });
    expect(described.retryAfterSeconds).toBe(OTP_COOLDOWN_SECONDS);
  });

  it("traduce un 429 sin sub-código", () => {
    const described = describeApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests",
    });
    expect(described.message).toContain("demasiadas solicitudes");
    expect(described.retryAfterSeconds).toBe(OTP_COOLDOWN_SECONDS);
  });

  it("reparte los detalles de validación por campo", () => {
    const described = describeApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Revisa el formulario.",
      details: [{ path: "code", message: "El código tiene 6 dígitos" }],
    });
    expect(described.errors.code).toBe("El código tiene 6 dígitos");
  });

  it("no filtra mensajes internos en un 500", () => {
    const described = describeApiError({
      status: 500,
      code: "INTERNAL",
      message: "D1_ERROR: no such table",
    });
    expect(described.message).not.toContain("D1_ERROR");
    expect(described.message).toContain("Inténtalo de nuevo");
  });

  it("marca el campo del token cuando falla Turnstile", () => {
    const described = describeApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "No pudimos verificar que no eres un robot.",
      reason: "TURNSTILE_FAILED",
    });
    expect(described.errors.turnstileToken).toBeDefined();
  });
});
