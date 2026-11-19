import { Link } from "react-router";

import { BrandMark } from "@tucatalogo/ui";

/**
 * Marca del console, coherente con `commercial` (mismo monograma "TC", misma
 * Fraunces y mismo chip), pero con el acento de producto "Console".
 *
 * Vive sobre la cabecera degradada (`--gradient-header`), así que el monograma
 * usa `surface` y el texto `onPrimary`. El chip usa `--gradient-badge` con
 * `primary` encima (6.69:1): es la única pieza teñida de la cabecera además
 * del propio degradado.
 */
export function ConsoleBrand() {
  return (
    <Link
      to="/"
      className="focus-ring-inverse flex min-w-0 items-center gap-2.5 rounded-[var(--radius-sm)]"
    >
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-surface text-primary shadow-[var(--shadow-sm)]"
      >
        <BrandMark className="size-full" />
      </span>
      <span className="font-heading text-[15px] font-semibold tracking-tight text-on-primary sm:text-base">
        TuCatálogo
      </span>
      <span className="rounded-[var(--radius-full)] [background-image:var(--gradient-badge)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
        Console
      </span>
    </Link>
  );
}
