import { describe, expect, it } from "vitest";

import { PROD_HOSTS, RESERVED_SLUGS } from "@tucatalogo/shared";

describe("configuración pública de commercial", () => {
  it("apunta al host de producción del plan", () => {
    expect(PROD_HOSTS.commercial).toBe("tucatalogo.luisrivas.site");
  });

  it("sus hosts están en la lista de reservados", () => {
    expect(RESERVED_SLUGS).toContain("tucatalogo");
    expect(RESERVED_SLUGS).toContain("console-tucatalogo");
  });
});
