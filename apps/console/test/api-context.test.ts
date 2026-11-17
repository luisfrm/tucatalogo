import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: { API: undefined, API_INTERNAL_URL: "http://127.0.0.1:9797" },
}));

import { apiContext } from "../app/lib/api.server";

describe("contexto del API en el console (B10)", () => {
  it("usa cf-connecting-ip y nunca x-forwarded-for", () => {
    const request = new Request("http://console.test/", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        "cf-connecting-ip": "198.51.100.7",
        cookie: "console.session_token=abc",
      },
    });

    expect(apiContext(request)).toEqual({
      cookie: "console.session_token=abc",
      clientIp: "198.51.100.7",
    });
  });

  it("sin cf-connecting-ip deja la IP ausente: no confía en el cliente", () => {
    const request = new Request("http://console.test/", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });

    expect(apiContext(request)).toEqual({ cookie: undefined, clientIp: undefined });
  });
});
