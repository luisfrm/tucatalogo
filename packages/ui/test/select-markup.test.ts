import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Select } from "../src/select";

/**
 * Contrato de markup del select nativo (PLAN §16). Las variantes visuales viven
 * en `variants.test.ts`; aquí solo lo que un test de clases no ve: atributos
 * ARIA, envoltorio del chevron y conservación de los atributos de formulario
 * (`name`/`required`), de los que depende el envío sin JS.
 */
function render(props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(
      Select,
      props,
      createElement("option", { key: "empty", value: "" }, "Elige"),
      createElement("option", { key: "eur", value: "EUR" }, "Euro"),
      createElement("option", { key: "cop", value: "COP" }, "Peso colombiano"),
    ),
  );
}

describe("Select (markup)", () => {
  it("solo marca aria-invalid cuando el campo es inválido", () => {
    expect(render()).not.toContain("aria-invalid");
    expect(render({ invalid: false })).not.toContain("aria-invalid");
    expect(render({ invalid: true })).toContain('aria-invalid="true"');
  });

  it("envuelve el select en un span relativo de ancho completo", () => {
    const html = render();
    expect(html).toMatch(/^<span class="[^"]*relative block w-full[^"]*"><select/);
    expect(html).toContain("</select><svg");
    // El chevron se posiciona contra el span, no contra el select.
    expect(html).toContain("pointer-events-none absolute");
    expect(html.endsWith("</span>")).toBe(true);
  });

  it("el chevron es decorativo y no captura foco ni clics", () => {
    const svg = render().match(/<svg[^>]*>/)?.[0] ?? "";
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).toContain("pointer-events-none");
  });

  it("conserva los atributos con los que el formulario envía el valor", () => {
    const html = render({
      id: "signup-currency",
      name: "currency",
      required: true,
      "aria-describedby": "signup-currency-hint",
    });
    expect(html).toContain('id="signup-currency"');
    expect(html).toContain('name="currency"');
    expect(html).toContain("required");
    expect(html).toContain('aria-describedby="signup-currency-hint"');
    expect(html).toContain('<option value="EUR">Euro</option>');
  });

  it("respeta `defaultValue` y `disabled` (filtros GET y campos bloqueados)", () => {
    // `defaultValue` es el camino de los filtros del panel: el valor viaja en el
    // `FormData` del `<Form method="get">` sin pasar por estado de React.
    const preselected = render({ name: "status", defaultValue: "EUR" });
    expect(preselected).toMatch(/<option value="EUR"[^>]*selected/);
    expect(preselected).not.toMatch(/<option value="COP"[^>]*selected/);

    const disabled = render({ name: "currency", disabled: true });
    expect(disabled).toMatch(/<select[^>]*disabled/);
    expect(disabled).toContain("disabled:opacity-60");
  });
});
