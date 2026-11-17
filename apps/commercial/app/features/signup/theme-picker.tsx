import type { ThemeMetadata } from "@tucatalogo/themes";

import { StorefrontPreview } from "~/components/storefront-preview";

/**
 * Selector de tema del paso 2. Cada tarjeta es un `label` con un radio real
 * (teclado + lectores de pantalla) y la preview usa el mismo bloque de tokens
 * que el storefront.
 */
export function ThemePicker({
  themes,
  value,
  onChange,
  error,
}: {
  themes: readonly ThemeMetadata[];
  value: string | null;
  onChange: (themeId: string) => void;
  error?: string;
}) {
  const errorId = error ? "signup-theme-error" : undefined;

  return (
    <fieldset
      id="signup-theme"
      tabIndex={-1}
      aria-describedby={errorId}
      className="space-y-3 outline-none"
    >
      <legend className="text-sm font-medium text-text">Tema de tu tienda</legend>
      <p className="text-xs leading-relaxed text-text-muted">
        Todos los temas comparten la misma estructura y tienen versión clara y oscura.
        Podrás cambiarlo cuando quieras desde el panel.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((theme) => {
          const selected = value === theme.id;
          return (
            <label
              key={theme.id}
              className={[
                "flex cursor-pointer flex-col gap-3 rounded-lg border bg-surface p-3",
                "transition-colors hover:border-border-strong",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                selected ? "border-primary bg-primary-subtle" : "border-border",
              ].join(" ")}
            >
              <input
                type="radio"
                name="themeId"
                value={theme.id}
                checked={selected}
                onChange={() => onChange(theme.id)}
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-sm font-semibold text-text">
                    {theme.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {theme.description}
                  </p>
                </div>
                {selected ? (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                    Elegido
                  </span>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-md border border-border">
                <StorefrontPreview themeId={theme.id} />
              </div>

              <ul aria-hidden="true" className="flex items-center gap-1.5">
                {theme.swatches.map((color) => (
                  <li
                    key={color}
                    className="size-4 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <li className="ml-1 text-[10px] text-text-muted">
                  {theme.fonts.heading} · {theme.fonts.body}
                </li>
              </ul>

              <ul className="flex flex-wrap gap-1">
                {theme.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
