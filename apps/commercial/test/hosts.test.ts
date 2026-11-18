import { describe, expect, it } from "vitest";

import { PROD_HOSTS, RESERVED_SLUGS } from "@tucatalogo/shared";

describe("configuración pública de commercial", () => {
  it("apunta al apex del dominio propio", () => {
    expect(PROD_HOSTS.commercial).toBe("tucatalogo.live");
    expect(PROD_HOSTS.storefrontRoot).toBe("tucatalogo.live");
  });

  it("los labels de la zona no pueden ser tiendas", () => {
    expect(RESERVED_SLUGS).toContain("tucatalogo");
    expect(RESERVED_SLUGS).toContain("console");
    expect(RESERVED_SLUGS).toContain("bucket");
  });
});
