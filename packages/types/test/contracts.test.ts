import { describe, expect, it } from "vitest";

import {
  ERROR_CODES,
  apiErrorEnvelopeSchema,
  currencySchema,
  httpStatusForErrorCode,
  storeSlugSchema,
} from "../src/index";

describe("error envelope", () => {
  it("expone el status del contrato", () => {
    expect(httpStatusForErrorCode("VALIDATION_ERROR")).toBe(400);
    expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe(503);
  });

  it("acepta un envelope válido y rechaza un código desconocido", () => {
    const valid = {
      error: {
        code: "CONFLICT",
        message: "El slug ya está en uso.",
        requestId: "req_1",
      },
    };

    expect(apiErrorEnvelopeSchema.safeParse(valid).success).toBe(true);
    expect(
      apiErrorEnvelopeSchema.safeParse({
        error: { ...valid.error, code: "NOPE" },
      }).success,
    ).toBe(false);
  });
});

describe("store schemas", () => {
  it("solo acepta las monedas del MVP", () => {
    expect(currencySchema.safeParse("COP").success).toBe(true);
    expect(currencySchema.safeParse("GBP").success).toBe(false);
  });

  it("valida el formato del slug", () => {
    expect(storeSlugSchema.safeParse("mi-tienda").success).toBe(true);
    expect(storeSlugSchema.safeParse("-mi-tienda").success).toBe(false);
    expect(storeSlugSchema.safeParse("MiTienda").success).toBe(false);
  });
});
