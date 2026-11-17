import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("api", () => {
  it("GET /health valida env, D1 y el host de media", async () => {
    const response = await SELF.fetch("http://api.internal/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
      version: string;
    };

    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ env: "ok", d1: "ok", media: "ok" });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("GET / describe el worker sin exponer secretos", async () => {
    const response = await SELF.fetch("http://api.internal/");
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.name).toBe("tucatalogo-api");
    expect(JSON.stringify(body)).not.toContain("INIT_TOKEN");
  });

  it("una ruta inexistente devuelve el envelope NOT_FOUND", async () => {
    const response = await SELF.fetch("http://api.internal/nope");
    expect(response.status).toBe(404);

    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTruthy();
  });
});
