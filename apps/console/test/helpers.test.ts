import { describe, expect, it } from "vitest";

import {
  formatAuditAction,
  formatAuditActorType,
  formatAuditTarget,
  summarizeMetadata,
} from "../app/lib/audit";
import {
  describeApiError,
  fieldErrorsFrom,
  isRateLimited,
  statusFromApiError,
  toApiErrorShape,
} from "../app/lib/errors";
import {
  parsePage,
  parseStatusFilter,
  readStoreFilters,
  storeListHref,
  totalPages,
} from "../app/lib/filters";
import {
  validatePasswordPair,
  validateSlugConfirmation,
  validateSuspendReason,
} from "../app/lib/validation.server";
import {
  describeStoreStatus,
  formatDate,
  formatDateTime,
  formatTime,
  groupByDay,
} from "../app/lib/format";
import { consoleResponseHeaders, consoleChallengeCookies } from "../app/lib/http.server";

describe("formato de estado y fechas", () => {
  it("traduce los tres estados con su tono", () => {
    expect(describeStoreStatus("active")).toEqual({ label: "Activa", tone: "success" });
    expect(describeStoreStatus("pending")).toEqual({ label: "Pendiente", tone: "warning" });
    expect(describeStoreStatus("suspended")).toEqual({
      label: "Suspendida",
      tone: "danger",
    });
  });

  it("formatea fechas siempre en UTC", () => {
    expect(formatDate("2026-11-17T10:05:00.000Z")).toBe("17 nov 2026");
    expect(formatDateTime("2026-11-17T10:05:00.000Z")).toBe("17 nov 2026, 10:05 UTC");
    expect(formatTime("2026-11-17T23:59:00.000Z")).toBe("23:59");
  });

  it("no inventa una fecha si el ISO no es válido", () => {
    expect(formatDate("no-es-fecha")).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("agrupa por día conservando el orden de entrada", () => {
    const items = [
      { id: "a", at: "2026-11-17T10:00:00.000Z" },
      { id: "b", at: "2026-11-17T22:30:00.000Z" },
      { id: "c", at: "2026-11-18T01:00:00.000Z" },
      { id: "d", at: "sin-fecha" },
    ];

    const groups = groupByDay(items, (item) => item.at);

    expect(groups.map((group) => group.key)).toEqual([
      "2026-11-17",
      "2026-11-18",
      "sin-fecha",
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(groups[0]?.label).toBe("17 nov 2026");
    expect(groups[2]?.label).toBe("Sin fecha");
  });
});

describe("filtros del listado", () => {
  it("normaliza la página a un entero positivo", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(null)).toBe(1);
  });

  it("solo acepta estados conocidos", () => {
    expect(parseStatusFilter("suspended")).toBe("suspended");
    expect(parseStatusFilter("")).toBeUndefined();
    expect(parseStatusFilter("deleted")).toBeUndefined();
  });

  it("lee búsqueda, estado y página de la query", () => {
    const params = new URLSearchParams({ q: "  rosé  ", status: "active", page: "2" });
    expect(readStoreFilters(params)).toEqual({ q: "rosé", status: "active", page: 2 });
  });

  it("construye enlaces de paginación conservando filtros", () => {
    expect(storeListHref({ q: "nube", status: "active", page: 2 }, 3)).toBe(
      "/?q=nube&status=active&page=3",
    );
    expect(storeListHref({ page: 1 }, 1)).toBe("/");
  });

  it("calcula el total de páginas con mínimo 1", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(41, 20)).toBe(3);
  });
});

describe("validación de motivo y slug", () => {
  it("exige un motivo de al menos 3 caracteres", () => {
    expect(validateSuspendReason("")).toEqual({
      ok: false,
      message: "Escribe el motivo de la suspensión",
    });
    expect(validateSuspendReason("ab")).toEqual({
      ok: false,
      message: "Escribe el motivo de la suspensión",
    });
  });

  it("recorta el motivo válido", () => {
    expect(validateSuspendReason("  Mantenimiento  ")).toEqual({
      ok: true,
      value: "Mantenimiento",
    });
  });

  it("exige escribir el slug exacto (sin distinguir mayúsculas)", () => {
    expect(validateSlugConfirmation("", "mi-tienda")).toEqual({
      ok: false,
      message: "Escribe el identificador de la tienda.",
    });
    expect(validateSlugConfirmation("otra", "mi-tienda")).toEqual({
      ok: false,
      message: "El identificador no coincide con el de la tienda.",
    });
    expect(validateSlugConfirmation("  MI-TIENDA ", "mi-tienda")).toEqual({
      ok: true,
      value: "MI-TIENDA",
    });
  });

  it("valida contraseña y confirmación", () => {
    expect(validatePasswordPair("corta", "corta")).toEqual({
      ok: false,
      message: "La contraseña debe tener al menos 8 caracteres",
    });
    expect(validatePasswordPair("12345678", "87654321")).toEqual({
      ok: false,
      message: "Las contraseñas no coinciden.",
    });
    expect(validatePasswordPair("12345678", "12345678")).toEqual({
      ok: true,
      value: "12345678",
    });
  });
});

describe("audit log", () => {
  it("etiqueta las acciones conocidas y deja ver las desconocidas", () => {
    expect(formatAuditAction("store.suspend")).toBe("Tienda suspendida");
    expect(formatAuditAction("product.create")).toBe("product.create");
    expect(formatAuditActorType("owner")).toBe("Dueño");
  });

  it("usa slug, luego id, luego guion", () => {
    expect(formatAuditTarget({ storeSlug: "nube", storeId: "s1" })).toBe("nube");
    expect(formatAuditTarget({ storeSlug: null, storeId: "s1" })).toBe("s1");
    expect(formatAuditTarget({ storeSlug: null, storeId: null })).toBe("—");
  });

  it("resume metadata y trunca lo largo", () => {
    expect(summarizeMetadata(null)).toBe("—");
    expect(summarizeMetadata({ reason: "spam" })).toBe('{"reason":"spam"}');
    const long = summarizeMetadata({ detail: "x".repeat(200) });
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBe(120);
  });
});

describe("cabeceras de respuesta del console", () => {
  it("copia las cookies del API sin reescribirlas y marca no-store", () => {
    const headers = consoleResponseHeaders([
      "console.session_token=abc; Path=/; HttpOnly; SameSite=Lax",
      "console.two_factor=xyz; Path=/; HttpOnly; SameSite=Lax",
    ]);

    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(headers.getSetCookie()).toEqual([
      "console.session_token=abc; Path=/; HttpOnly; SameSite=Lax",
      "console.two_factor=xyz; Path=/; HttpOnly; SameSite=Lax",
    ]);
  });

  it("no inventa cookies cuando el API no devuelve ninguna", () => {
    expect(consoleResponseHeaders().getSetCookie()).toEqual([]);
  });

  it("M1: el login solo puede reenviar el challenge de 2FA, no la sesión", () => {
    const cookies = consoleChallengeCookies([
      "console.two_factor=challenge; Path=/; HttpOnly",
      "__Secure-console.two_factor=secure-challenge; Path=/; HttpOnly",
      "console.session_token=NO; Path=/; HttpOnly",
      "__Secure-console.session_token=NO; Path=/; HttpOnly",
      "console.dont_remember=1; Path=/",
    ]);

    expect(cookies).toEqual([
      "console.two_factor=challenge; Path=/; HttpOnly",
      "__Secure-console.two_factor=secure-challenge; Path=/; HttpOnly",
    ]);
  });

  it("M1: sin cookies del login no se inventa un challenge", () => {
    expect(consoleChallengeCookies([])).toEqual([]);
  });
});

describe("errores del API", () => {
  it("reconoce la forma del error y los 429", () => {
    const error = { status: 429, message: "Demasiados intentos.", retryAfterSeconds: 42 };
    expect(isRateLimited(error)).toBe(true);
    expect(toApiErrorShape(error)?.retryAfterSeconds).toBe(42);
    expect(statusFromApiError(error)).toBe(429);
  });

  it("incluye la espera del Retry-After cuando está disponible", () => {
    expect(
      describeApiError({ status: 429, message: "Demasiados intentos.", retryAfterSeconds: 42 }),
    ).toBe("Demasiados intentos. Vuelve a intentarlo en 42 s.");
    expect(describeApiError({ status: 429, message: "Demasiados intentos." })).toBe(
      "Demasiados intentos.",
    );
  });

  it("cae al mensaje genérico si el error no tiene forma reconocible", () => {
    expect(describeApiError(new Error("boom"), "Fallo controlado")).toBe("Fallo controlado");
    expect(statusFromApiError(new Error("boom"))).toBe(500);
  });

  it("extrae errores por campo de details", () => {
    const errors = fieldErrorsFrom({
      status: 400,
      message: "Revisa",
      details: [
        { path: "reason", message: "Motivo obligatorio" },
        { path: "reason", message: "Duplicado" },
        { path: "slug", message: "No coincide" },
      ],
    });
    expect(errors).toEqual({ reason: "Motivo obligatorio", slug: "No coincide" });
  });
});
