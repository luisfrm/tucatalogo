import { describe, expect, it } from "vitest";

import { loader } from "~/routes/favicon";

/**
 * `/favicon.ico` no debe responder 404: los clientes que lo piden por defecto se
 * redirigen (308) al único favicon declarado en el `<head>`.
 */
describe("GET /favicon.ico", () => {
  it("redirige permanentemente a /favicon.svg", () => {
    const response = loader() as Response;

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/favicon.svg");
  });
});
