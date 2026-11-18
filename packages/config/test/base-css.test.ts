import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, "..", "..");

function read(...segments: string[]) {
  return readFileSync(join(packageDir, ...segments), "utf8");
}

describe("tailwind/base.css: 16px en móvil", () => {
  const css = read("tailwind", "base.css");

  it("fija 16px solo por debajo de 640px", () => {
    expect(css).toContain("@layer base");
    expect(css).toMatch(/@media \(max-width: 639\.98px\)/);
    expect(css).toContain("font-size: 16px");
  });

  it("cubre input, select y textarea y excluye los tipos sin zoom", () => {
    expect(css).toContain("input:not([type=\"checkbox\"])");
    expect(css).toContain("select,");
    expect(css).toContain("textarea");

    for (const type of ["checkbox", "radio", "range", "color", "file"]) {
      expect(css, type).toContain(`:not([type="${type}"])`);
    }
  });

  it("está publicado como subpath y lo importan las tres apps", () => {
    const pkg = JSON.parse(read("package.json")) as {
      exports: Record<string, string>;
    };
    expect(pkg.exports["./tailwind/base.css"]).toBe("./tailwind/base.css");

    for (const app of ["web", "console", "commercial"]) {
      const appCss = readFileSync(join(repoRoot, "apps", app, "app", "app.css"), "utf8");
      const lines = appCss.split("\n");

      const tailwindAt = lines.findIndex((line) => line.startsWith('@import "tailwindcss"'));
      const baseAt = lines.findIndex((line) =>
        line.includes('"@tucatalogo/config/tailwind/base.css"'),
      );

      expect(tailwindAt, app).toBeGreaterThanOrEqual(0);
      expect(baseAt, app).toBeGreaterThan(tailwindAt);
    }
  });
});
