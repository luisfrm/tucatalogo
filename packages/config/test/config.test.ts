import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

describe("@tucatalogo/config", () => {
  it("la base de TypeScript es estricta", () => {
    const base = JSON.parse(
      readFileSync(join(packageDir, "tsconfig", "base.json"), "utf8"),
    ) as { compilerOptions: { strict: boolean; noEmit: boolean } };

    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.noEmit).toBe(true);
  });

  it("expone la flat config de ESLint", async () => {
    const mod = (await import("../eslint/index.js")) as { default: unknown };
    expect(Array.isArray(mod.default)).toBe(true);
  });
});
