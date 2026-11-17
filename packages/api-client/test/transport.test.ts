import { describe, expect, it, vi } from "vitest";

import {
  ApiTransportError,
  SERVICE_BINDING_BASE_URL,
  createApiTransport,
} from "../src/transport";

describe("adapter de transporte", () => {
  it("falla de forma explícita sin binding ni URL", () => {
    expect(() => createApiTransport({})).toThrow(ApiTransportError);
  });

  it("usa el service binding cuando existe", async () => {
    const fetchSpy = vi.fn(async (_request: Request) => new Response("{}", { status: 200 }));
    const transport = createApiTransport({ API: { fetch: fetchSpy } });

    await transport.fetch("http://api.internal/health");

    expect(transport.baseUrl).toBe(SERVICE_BINDING_BASE_URL);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(Request));
  });

  it("en local habla con 127.0.0.1:9797 sin barra final", () => {
    const transport = createApiTransport({
      API_INTERNAL_URL: "http://127.0.0.1:9797/",
    });

    expect(transport.baseUrl).toBe("http://127.0.0.1:9797");
  });
});
