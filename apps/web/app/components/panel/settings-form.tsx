import type { Currency, PanelStore } from "@tucatalogo/types";
import type { ThemeMetadata } from "@tucatalogo/themes";
import { Button, Input, Select, cn } from "@tucatalogo/ui";
import { useId, useMemo, useState } from "react";
import { Form } from "react-router";

import { buildWhatsappPreview, whatsappTemplateUsesPlaceholders, type PanelActionData } from "~/lib/panel";

import { Field, FormError, PanelAlert } from "./panel-ui";

/**
 * Formulario de datos de la tienda. Es cliente solo por los controles
 * sincronizados (color picker ↔ hex) y el preview de WhatsApp; la validación
 * real y la escritura ocurren en el action con los schemas Zod compartidos.
 */

const CURRENCY_NOTES: Record<Currency, string> = {
  USD: "Dólar estadounidense (2 decimales).",
  EUR: "Euro (2 decimales).",
  COP: "Peso colombiano (2 decimales).",
  VES: "Bolívar venezolano (2 decimales).",
  ARS: "Peso argentino (2 decimales).",
};

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function ThemeCard({
  theme,
  selected,
  mode,
  onSelect,
}: {
  theme: ThemeMetadata;
  selected: boolean;
  mode: "light" | "dark";
  onSelect: () => void;
}) {
  return (
    <label
      data-theme={theme.id}
      data-color-mode={mode}
      className={cn(
        "relative flex cursor-pointer flex-col gap-2 rounded-[var(--radius-md)] border-[length:var(--border-width)] p-3 transition-colors",
        "bg-bg text-text",
        selected
          ? "border-[var(--color-ring)] ring-2 ring-[var(--color-ring)] ring-offset-2 ring-offset-[var(--color-bg)]"
          : "border-border hover:border-border-strong",
      )}
    >
      <input
        type="radio"
        name="themeId"
        value={theme.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="font-heading text-sm font-semibold">{theme.name}</span>
        <span aria-hidden="true" className="flex gap-1">
          {theme.swatches.slice(0, 4).map((swatch) => (
            <span
              key={swatch}
              className="size-3 rounded-full border border-black/10"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </span>
      </span>
      <span className="text-xs text-text-muted">{theme.description}</span>
      <span
        aria-hidden="true"
        className="mt-1 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-surface p-2"
      >
        <span className="flex flex-col gap-1">
          <span className="h-2 w-14 rounded-full bg-text" />
          <span className="h-1.5 w-10 rounded-full bg-text-muted" />
        </span>
        <span className="rounded-[var(--radius-sm)] bg-primary px-2 py-1 text-[10px] font-semibold text-on-primary">
          Comprar
        </span>
      </span>
      <span className="sr-only">
        {selected ? "Tema seleccionado." : "Seleccionar tema."}
      </span>
    </label>
  );
}

export function SettingsForm({
  store,
  themes,
  previewCss,
  actionData,
}: {
  store: PanelStore;
  themes: ThemeMetadata[];
  previewCss: string;
  actionData?: PanelActionData;
}) {
  const [name, setName] = useState(store.name);
  const [themeId, setThemeId] = useState(store.themeId);
  const [color, setColor] = useState(store.primaryColor);
  const [colorModeDefault, setColorModeDefault] = useState(store.colorModeDefault);
  const [currency, setCurrency] = useState(store.currency);
  const [whatsappNumber, setWhatsappNumber] = useState(store.whatsappNumber ?? "");
  const [whatsappTemplate, setWhatsappTemplate] = useState(store.whatsappMessageTemplate ?? "");
  const idPrefix = useId();

  const numberError =
    whatsappNumber.trim().length > 0 && !/^\d{8,15}$/.test(whatsappNumber.trim())
      ? "Escribe el número con código de país, solo dígitos (8 a 15)."
      : undefined;

  const previewLink = useMemo(
    () =>
      buildWhatsappPreview({
        number: whatsappNumber,
        template: whatsappTemplate,
        productName: "Zapatos de ejemplo",
        priceLabel: "49,90",
        storeName: name || store.name,
      }),
    [whatsappNumber, whatsappTemplate, name, store.name],
  );

  const showFormError = actionData?.intent === "save-store" && !actionData.ok;
  const fieldErrors = showFormError ? (actionData.fieldErrors ?? {}) : {};

  return (
    <Form method="post" className="flex flex-col gap-5" noValidate>
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />
      <input type="hidden" name="intent" value="save-store" />

      {showFormError && actionData.formError ? (
        <PanelAlert tone="danger" title="No se guardaron los cambios">
          <p>{actionData.formError}</p>
        </PanelAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-name`}
          label="Nombre de la tienda"
          error={fieldErrors.name}
          hint="Se muestra en el catálogo y en el panel."
          required
        >
          <Input
            id={`${idPrefix}-name`}
            name="name"
            value={name}
            maxLength={80}
            invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? `${idPrefix}-name-error` : undefined}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Field>

        <Field
          id={`${idPrefix}-currency`}
          label="Moneda"
          error={fieldErrors.currency}
          hint="Cambiar la moneda no convierte los precios existentes: solo cambia cómo se muestran."
          required
        >
          <Select
            id={`${idPrefix}-currency`}
            name="currency"
            value={currency}
            invalid={Boolean(fieldErrors.currency)}
            aria-describedby={
              fieldErrors.currency ? `${idPrefix}-currency-error` : `${idPrefix}-currency-hint`
            }
            onChange={(event) => setCurrency(event.currentTarget.value as Currency)}
          >
            {(Object.keys(CURRENCY_NOTES) as Currency[]).map((option) => (
              <option key={option} value={option}>
                {option} — {CURRENCY_NOTES[option]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-mode`}
          label="Modo por defecto del storefront"
          hint="El visitante puede cambiarlo; el panel conserva su propio modo."
          error={fieldErrors.colorModeDefault}
        >
          <Select
            id={`${idPrefix}-mode`}
            name="colorModeDefault"
            value={colorModeDefault}
            invalid={Boolean(fieldErrors.colorModeDefault)}
            aria-describedby={
              fieldErrors.colorModeDefault ? `${idPrefix}-mode-error` : `${idPrefix}-mode-hint`
            }
            onChange={(event) =>
              setColorModeDefault(event.currentTarget.value === "dark" ? "dark" : "light")
            }
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </Select>
        </Field>

        <Field
          id={`${idPrefix}-color`}
          label="Color principal"
          hint="El motor OKLCH ajusta el contraste a AA. Se usa como acento."
          error={fieldErrors.primaryColor ?? (isHex(color) ? undefined : "Usa un hex #RRGGBB.")}
          required
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Elegir color principal"
              value={isHex(color) ? color : store.primaryColor}
              onChange={(event) => setColor(event.currentTarget.value.toUpperCase())}
              className="h-11 w-14 cursor-pointer rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface p-1"
            />
            <Input
              id={`${idPrefix}-color`}
              name="primaryColor"
              value={color}
              maxLength={7}
              invalid={!isHex(color)}
              aria-describedby={fieldErrors.primaryColor ? `${idPrefix}-color-error` : `${idPrefix}-color-hint`}
              onChange={(event) => setColor(event.currentTarget.value.trim().toUpperCase())}
              className="font-mono uppercase"
            />
          </div>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tema del catálogo</legend>
        <p className="text-xs text-text-muted">
          La vista previa usa el color guardado. El panel siempre mantiene su superficie neutral.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              mode={colorModeDefault}
              selected={themeId === theme.id}
              onSelect={() => setThemeId(theme.id)}
            />
          ))}
        </div>
        {fieldErrors.themeId ? <FormError message={fieldErrors.themeId} /> : null}
      </fieldset>

      <div className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface-2 p-3">
        <p className="text-sm font-medium">Vista del acento elegido</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="size-10 rounded-full border border-black/10"
            style={{ backgroundColor: isHex(color) ? color : store.primaryColor }}
          />
          <span
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-white shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: isHex(color) ? color : store.primaryColor }}
          >
            Botón de ejemplo
          </span>
          <span className="text-xs text-text-muted">
            El texto del botón se recalcula para cumplir contraste al guardar.
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-whatsapp`}
          label="WhatsApp"
          hint="Código de país sin +. Déjalo vacío para ocultar el pedido por WhatsApp."
          error={fieldErrors.whatsappNumber ?? numberError}
        >
          <Input
            id={`${idPrefix}-whatsapp`}
            name="whatsappNumber"
            inputMode="numeric"
            value={whatsappNumber}
            maxLength={15}
            invalid={Boolean(fieldErrors.whatsappNumber || numberError)}
            aria-describedby={
              fieldErrors.whatsappNumber || numberError
                ? `${idPrefix}-whatsapp-error`
                : `${idPrefix}-whatsapp-hint`
            }
            onChange={(event) => setWhatsappNumber(event.currentTarget.value.replace(/[^\d]/g, ""))}
            placeholder="584141234567"
          />
        </Field>

        <Field
          id={`${idPrefix}-template`}
          label="Plantilla del mensaje"
          hint="Variables disponibles: {producto}, {precio} y {tienda}."
          error={fieldErrors.whatsappMessageTemplate}
        >
          <textarea
            id={`${idPrefix}-template`}
            name="whatsappMessageTemplate"
            value={whatsappTemplate}
            maxLength={300}
            rows={3}
            onChange={(event) => setWhatsappTemplate(event.currentTarget.value)}
            className="block w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 py-2 text-base sm:text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface-2 p-3">
        <p className="text-sm font-medium">Vista previa del pedido</p>
        <p className="mt-1 text-sm text-text-muted">
          {previewLink
            ? "El botón de WhatsApp abrirá este enlace desde cada producto."
            : "Configura un número válido para generar el enlace de WhatsApp."}
        </p>
        {previewLink ? (
          <p className="mt-2 break-all font-mono text-xs text-text">{previewLink}</p>
        ) : null}
        {whatsappTemplate && !whatsappTemplateUsesPlaceholders(whatsappTemplate) ? (
          <p className="mt-2 text-xs text-warning">
            La plantilla no usa ninguna variable: todos los mensajes serán idénticos.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Guardar cambios</Button>
        <span className="text-xs text-text-muted">
          Los cambios de tema y color se ven en la tienda al guardar.
        </span>
      </div>
    </Form>
  );
}
