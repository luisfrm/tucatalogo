import { useState } from "react";
import type { ThemeMetadata } from "@tucatalogo/themes";
import type { ColorMode } from "@tucatalogo/types";
import { Badge, Input } from "@tucatalogo/ui";

import { RealStorefrontPreview } from "~/components/real-storefront-preview";
import { ThemeFontLoader } from "~/components/theme-fonts";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Step 2 theme and brand color picker with live light/dark storefront preview.
 */
export function ThemePicker({
  themes,
  value,
  primaryColor,
  onChange,
  onPrimaryColorChange,
  error,
}: {
  themes: readonly ThemeMetadata[];
  value: string | null;
  primaryColor: string;
  onChange: (themeId: string) => void;
  onPrimaryColorChange: (hex: string) => void;
  error?: string;
}) {
  const errorId = error ? "signup-theme-error" : undefined;
  const selectedTheme = themes.find((t) => t.id === value) ?? themes[0];
  const [previewMode, setPreviewMode] = useState<ColorMode>(
    selectedTheme?.defaultPreviewMode ?? "light",
  );

  const validHex = HEX_COLOR_RE.test(primaryColor)
    ? primaryColor
    : selectedTheme?.defaultPrimaryColor ?? "#C09299";

  return (
    <fieldset
      id="signup-theme"
      tabIndex={-1}
      aria-describedby={errorId}
      className="space-y-5 outline-none"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <legend className="text-sm font-semibold text-text">
            Tema y color de tu tienda
          </legend>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Todos los temas tienen versión clara y oscura. El motor OKLCH ajusta tu color de
            marca para garantizar contraste AA.
          </p>
        </div>

        <div
          role="group"
          aria-label="Modo de vista previa"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-[var(--radius-md)] border border-border bg-surface-2 p-1"
        >
          {(["light", "dark"] as const).map((modeOption) => (
            <button
              key={modeOption}
              type="button"
              onClick={() => setPreviewMode(modeOption)}
              aria-pressed={previewMode === modeOption}
              className={[
                "cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors",
                previewMode === modeOption
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text",
              ].join(" ")}
            >
              {modeOption === "light" ? "Claro" : "Oscuro"}
            </button>
          ))}
        </div>
      </div>

      <ThemeFontLoader target="#signup-theme" />

      <div className="grid gap-3.5 sm:grid-cols-2">
        {themes.map((theme) => {
          const selected = value === theme.id;
          const cardMode = selected ? previewMode : theme.defaultPreviewMode;

          return (
            <label
              key={theme.id}
              className={[
                "flex cursor-pointer flex-col gap-3 rounded-[var(--radius-lg)] border bg-surface p-3.5 transition-all",
                "hover:border-border-strong hover:shadow-sm",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                selected
                  ? "border-primary bg-primary-subtle/40 ring-1 ring-primary"
                  : "border-border",
              ].join(" ")}
            >
              <input
                type="radio"
                name="themeId"
                value={theme.id}
                checked={selected}
                onChange={() => {
                  onChange(theme.id);
                  setPreviewMode(theme.defaultPreviewMode);
                }}
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-semibold text-text">
                    {theme.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {theme.description}
                  </p>
                </div>
                {selected ? <Badge variant="primary">Elegido</Badge> : null}
              </div>

              <div className="overflow-hidden rounded-[var(--radius-md)] border border-border shadow-sm">
                <RealStorefrontPreview
                  themeId={theme.id}
                  mode={cardMode}
                  viewport="mobile"
                  primaryColor={selected ? validHex : undefined}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <ul aria-hidden="true" className="flex items-center gap-1.5">
                  {theme.swatches.map((color) => (
                    <li
                      key={color}
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </ul>
                <span className="text-[11px] font-medium text-text-muted">
                  {theme.fonts.heading} + {theme.fonts.body}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Brand primary color customization */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface-2/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label
              htmlFor="signup-primary-color"
              className="text-sm font-semibold text-text"
            >
              Color principal de tu marca
            </label>
            <p className="mt-0.5 text-xs text-text-muted">
              Personaliza botones y acentos. Se ajusta automáticamente para legibilidad.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Selector visual de color principal"
              value={validHex}
              onChange={(event) =>
                onPrimaryColorChange(event.currentTarget.value.toUpperCase())
              }
              className="h-11 w-14 cursor-pointer rounded-[var(--radius-md)] border border-border-strong bg-surface p-1"
            />
            <Input
              id="signup-primary-color"
              name="primaryColor"
              value={primaryColor}
              maxLength={7}
              onChange={(event) =>
                onPrimaryColorChange(event.currentTarget.value.trim().toUpperCase())
              }
              className="w-28 font-mono uppercase"
              placeholder="#C09299"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
