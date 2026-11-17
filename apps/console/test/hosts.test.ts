import { describe, expect, it } from "vitest";

import { getSlugRejectionReason, PROD_HOSTS } from "@tucatalogo/shared";

describe("configuración del console", () => {
  it("usa el host exacto de producción", () => {
    expect(PROD_HOSTS.console).toBe("console-tucatalogo.luisrivas.site");
  });

  it("su host no puede ser una tienda", () => {
    expect(getSlugRejectionReason("console-tucatalogo")).toBe("reserved");
  });
});
