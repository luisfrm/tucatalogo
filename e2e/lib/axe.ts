import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * axe (PLAN §14): sin violaciones critical/serious en las tres superficies.
 *
 * Se excluyen las reglas que dependen de recursos de terceros que no están bajo
 * control del producto (el iframe de Turnstile), y nada más: cualquier
 * violación real de contraste, labels o landmarks debe fallar el test.
 */
const DISABLED_RULES = ["frame-tested"];

/**
 * Congela transiciones/animaciones antes de medir.
 *
 * El cambio de tema (claro ↔ oscuro) anima `background-color` 150 ms; si axe
 * corre en medio, mide un color interpolado y reporta un contraste falso. El
 * contraste se audita sobre el estado final, no sobre un frame intermedio.
 */
async function freezeMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
}

export async function expectNoSeriousA11yViolations(page: Page, surface: string): Promise<void> {
  await freezeMotion(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(DISABLED_RULES)
    .analyze();

  const blockers = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  const summary = blockers.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
  }));

  await expect
    .soft(blockers, `axe · ${surface} · violaciones critical/serious` as string)
    .toEqual([]);

  if (summary.length > 0) {
    // Deja el detalle legible en el reporte además del diff del expect.
    console.error(`axe ${surface}: ${JSON.stringify(summary, null, 2)}`);
  }
}
