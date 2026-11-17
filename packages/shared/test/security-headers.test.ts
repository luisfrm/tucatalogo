import { describe, expect, it } from "vitest";

import {
  BASE_PERMISSIONS_POLICY,
  PRODUCTION_HSTS,
  withSecurityHeaders,
} from "../src/libs/security-headers";

const local = { surface: "storefront", environment: "local" } as const;
const prod = { surface: "storefront", environment: "production" } as const;

describe("withSecurityHeaders", () => {
  it("añade las cabeceras base a una Response sin headers", () => {
    const response = withSecurityHeaders(
      new Response("<html></html>", { status: 200 }),
      local,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("permissions-policy")).toBe(
      BASE_PERMISSIONS_POLICY,
    );
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("console y /panel-admin no se pueden enmarcar", () => {
    for (const surface of ["console", "panel-admin"] as const) {
      const response = withSecurityHeaders(new Response(""), {
        surface,
        environment: "local",
      });

      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toBe(
        "frame-ancestors 'none'",
      );
    }
  });

  it("añade frame-ancestors sin borrar una CSP existente", () => {
    const response = new Response("", {
      headers: { "content-security-policy": "default-src 'self';" },
    });

    const wrapped = withSecurityHeaders(response, {
      surface: "panel-admin",
      environment: "production",
    });

    expect(wrapped.headers.get("content-security-policy")).toBe(
      "default-src 'self'; frame-ancestors 'none'",
    );
  });

  it("respeta una CSP que ya limita frame-ancestors", () => {
    const original = "default-src 'self'; frame-ancestors 'self'";
    const response = new Response("", {
      headers: { "content-security-policy": original },
    });

    const wrapped = withSecurityHeaders(response, {
      surface: "panel-admin",
      environment: "local",
    });

    expect(wrapped.headers.get("content-security-policy")).toBe(original);
  });

  it("no sobrescribe cabeceras existentes ni pierde Set-Cookie", () => {
    const response = new Response("", {
      headers: [
        ["cache-control", "private, max-age=0"],
        ["set-cookie", "store_session=a; Path=/; HttpOnly"],
        ["set-cookie", "store_theme=b; Path=/"],
        ["x-frame-options", "SAMEORIGIN"],
      ],
    });

    const wrapped = withSecurityHeaders(response, {
      surface: "panel-admin",
      environment: "production",
    });

    expect(wrapped.headers.get("cache-control")).toBe("private, max-age=0");
    expect(wrapped.headers.get("x-frame-options")).toBe("SAMEORIGIN");

    const cookies = (
      wrapped.headers as Headers & { getSetCookie: () => string[] }
    ).getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.join("\n")).toContain("store_session=a");
    expect(cookies.join("\n")).toContain("store_theme=b");
  });

  it("solo añade HSTS en producción", () => {
    const production = withSecurityHeaders(new Response(""), prod);
    expect(production.headers.get("strict-transport-security")).toBe(
      PRODUCTION_HSTS,
    );

    const development = withSecurityHeaders(new Response(""), {
      surface: "storefront",
      environment: "development",
    });
    expect(development.headers.get("strict-transport-security")).toBeNull();
  });

  it("sobrevive a headers inmutables sin perder status ni Location", () => {
    const redirect = Response.redirect("https://example.com/login", 302);

    const wrapped = withSecurityHeaders(redirect, {
      surface: "panel-admin",
      environment: "production",
    });

    expect(wrapped.status).toBe(302);
    expect(wrapped.headers.get("location")).toBe("https://example.com/login");
    expect(wrapped.headers.get("x-frame-options")).toBe("DENY");
    expect(wrapped.headers.get("strict-transport-security")).toBe(
      PRODUCTION_HSTS,
    );
  });
});
