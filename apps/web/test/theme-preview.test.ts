import { listThemeMetadata } from "@tucatalogo/themes";
import { describe, expect, it } from "vitest";

import { buildThemePreviewCss } from "../app/lib/theme-preview";

describe("preview de temas del panel", () => {
  const themes = listThemeMetadata();

  it("devuelve solo CSS, sin etiquetas <style> anidadas", () => {
    const css = buildThemePreviewCss(themes, "#C09299");

    expect(css.length).toBeGreaterThan(0);
    expect(css).not.toContain("<style");
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
  });

  it("incluye los 5 temas en claro y oscuro", () => {
    const css = buildThemePreviewCss(themes, "#C09299");

    for (const theme of themes) {
      expect(css).toContain(`[data-theme="${theme.id}"]`);
      expect(css).toContain(`[data-theme="${theme.id}"][data-color-mode="dark"]`);
    }
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("color-scheme: dark");
  });
});
