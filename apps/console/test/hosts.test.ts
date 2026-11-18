import { describe, expect, it } from "vitest";

import { getSlugRejectionReason, PROD_HOSTS } from "@tucatalogo/shared";

describe("configuración del console", () => {
  it("usa el host exacto de producción", () => {
    expect(PROD_HOSTS.console).toBe("console.tucatalogo.live");
  });

  it("su label no puede ser una tienda", () => {
    expect(getSlugRejectionReason("console")).toBe("reserved");
  });
});
