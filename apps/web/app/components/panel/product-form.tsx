import type { Currency, PanelCategory, PanelProduct } from "@tucatalogo/types";
import { Button, Input } from "@tucatalogo/ui";
import { useId, useMemo, useState } from "react";
import { Form } from "react-router";

import {
  formatMinorForInput,
  parsePriceToMinor,
  slugifyCatalogName,
  type PanelActionData,
} from "~/lib/panel";
import { formatStorePrice } from "~/lib/price";

import { Field, PanelAlert } from "./panel-ui";

/**
 * Formulario compartido de alta/edición. El precio se escribe en decimal y el
 * action lo convierte a unidad mínima; el slug se autogenera del nombre y se
 * puede editar antes de guardar.
 */
export function ProductForm({
  mode,
  product,
  categories,
  currency,
  actionData,
}: {
  mode: "create" | "edit";
  product?: PanelProduct;
  categories: PanelCategory[];
  currency: Currency;
  actionData?: PanelActionData;
}) {
  const id = useId();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(
    product ? formatMinorForInput(product.priceMinor, product.currency) : "",
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const currencyOrDefault = product?.currency ?? currency;
  const parsedPrice = useMemo(
    () => parsePriceToMinor(price, currencyOrDefault),
    [price, currencyOrDefault],
  );
  const effectiveSlug = slugTouched ? slug : slugifyCatalogName(name);
  const showError = actionData && actionData.ok === false && actionData.intent === `product-${mode}`;
  const fieldErrors = showError ? actionData.fieldErrors ?? {} : {};

  return (
    <Form method="post" className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="intent" value={mode === "create" ? "create" : "update"} />

      {showError && actionData.formError ? (
        <PanelAlert tone="danger" title="No se guardó el producto">
          <p>{actionData.formError}</p>
        </PanelAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${id}-name`}
          label="Nombre"
          error={fieldErrors.name}
          hint="Entre 2 y 120 caracteres."
          required
        >
          <Input
            id={`${id}-name`}
            name="name"
            value={name}
            maxLength={120}
            invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? `${id}-name-error` : `${id}-name-hint`}
            onChange={(event) => setName(event.currentTarget.value)}
            required
          />
        </Field>

        <Field
          id={`${id}-slug`}
          label="Identificador (slug)"
          error={fieldErrors.slug}
          hint="Solo minúsculas, números y guiones. Debe ser único en tu tienda."
          required
        >
          <Input
            id={`${id}-slug`}
            name="slug"
            value={effectiveSlug}
            maxLength={63}
            invalid={Boolean(fieldErrors.slug)}
            aria-describedby={fieldErrors.slug ? `${id}-slug-error` : `${id}-slug-hint`}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.currentTarget.value.toLowerCase());
            }}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={`${id}-price`}
          label={`Precio (${currencyOrDefault})`}
          error={fieldErrors.priceMinor ?? (parsedPrice.ok ? undefined : parsedPrice.error)}
          hint={
            parsedPrice.ok
              ? `Se mostrará como ${formatStorePrice(parsedPrice.value, currencyOrDefault)}.`
              : "Decimal con coma o punto. No se convierte moneda."
          }
          required
        >
          <Input
            id={`${id}-price`}
            name="price"
            inputMode="decimal"
            value={price}
            invalid={!parsedPrice.ok}
            aria-describedby={fieldErrors.priceMinor ? `${id}-price-error` : `${id}-price-hint`}
            onChange={(event) => setPrice(event.currentTarget.value)}
            placeholder="49,90"
            required
          />
        </Field>

        <Field
          id={`${id}-category`}
          label="Categoría"
          error={fieldErrors.categoryId}
          hint="Opcional. Si borras la categoría, el producto queda sin categoría."
        >
          <select
            id={`${id}-category`}
            name="categoryId"
            value={categoryId ?? ""}
            onChange={(event) => setCategoryId(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`${id}-active`} label="Visibilidad" hint="Los productos ocultos no se publican.">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            Visible en la tienda
          </label>
          <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
        </Field>
      </div>

      <Field
        id={`${id}-description`}
        label="Descripción"
        error={fieldErrors.description}
        hint="Máximo 2000 caracteres. Se muestra en la ficha del producto."
      >
        <textarea
          id={`${id}-description`}
          name="description"
          value={description}
          maxLength={2000}
          rows={5}
          onChange={(event) => setDescription(event.currentTarget.value)}
          className="block w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">{mode === "create" ? "Crear producto" : "Guardar cambios"}</Button>
        <span className="text-xs text-text-muted">
          {mode === "create"
            ? "Después de crearlo podrás subir hasta 8 imágenes."
            : "Las imágenes se gestionan debajo de este formulario."}
        </span>
      </div>
    </Form>
  );
}
