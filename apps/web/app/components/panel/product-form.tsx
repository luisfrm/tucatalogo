import type { Currency, PanelCategory, PanelProduct } from "@tucatalogo/types";
import { Button, Input, Select, Textarea } from "@tucatalogo/ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Form, useNavigate } from "react-router";

import { normalizeProductImage, validateSourceImage } from "~/lib/image-normalize";
import {
  PRODUCT_IMAGE_LIMIT as MAX_PRODUCT_IMAGES,
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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(
    product ? formatMinorForInput(product.priceMinor, product.currency) : "",
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [stagedImages, setStagedImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      for (const item of stagedImages) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [stagedImages]);

  function handleSelectImages(event: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    const chosen = Array.from(event.currentTarget.files ?? []);
    if (chosen.length === 0) return;

    const remaining = MAX_PRODUCT_IMAGES - stagedImages.length;
    if (remaining <= 0) {
      setClientError(`Máximo ${MAX_PRODUCT_IMAGES} imágenes por producto.`);
      return;
    }

    const accepted: Array<{ file: File; previewUrl: string }> = [];
    for (const file of chosen.slice(0, remaining)) {
      const invalid = validateSourceImage(file);
      if (invalid) {
        setClientError(invalid);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) {
      setStagedImages((prev) => [...prev, ...accepted]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeStagedImage(indexToRemove: number) {
    setStagedImages((prev) => {
      const target = prev[indexToRemove];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  }

  async function handleCreateWithImages(event: React.FormEvent<HTMLFormElement>) {
    if (mode !== "create" || stagedImages.length === 0) return;
    event.preventDefault();
    setClientError(null);
    setSubmitting(true);
    setUploadStatus("Creando producto...");

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("responseMode", "json");

      const createRes = await fetch(window.location.href, {
        method: "POST",
        body: formData,
      });
      const createPayload = (await createRes.json().catch(() => null)) as {
        ok?: boolean;
        productId?: string;
        nextUrl?: string;
        formError?: string;
      } | null;

      if (!createRes.ok || !createPayload?.ok || !createPayload.productId) {
        setClientError(createPayload?.formError ?? "No pudimos crear el producto. Revisa los campos.");
        setUploadStatus(null);
        setSubmitting(false);
        return;
      }

      const productId = createPayload.productId;
      for (let i = 0; i < stagedImages.length; i += 1) {
        setUploadStatus(`Optimizando y subiendo imagen ${i + 1} de ${stagedImages.length}...`);
        const normalized = await normalizeProductImage(stagedImages[i].file);
        const imgForm = new FormData();
        imgForm.set("intent", "upload-image");
        imgForm.set("productId", productId);
        imgForm.set("full", normalized.full.blob, "full.webp");
        imgForm.set("thumb", normalized.thumb.blob, "thumb.webp");
        imgForm.set("alt", name.trim() || "Imagen del producto");
        imgForm.set("width", String(normalized.full.width));
        imgForm.set("height", String(normalized.full.height));

        const imgRes = await fetch(window.location.href, {
          method: "POST",
          body: imgForm,
        });
        if (!imgRes.ok) {
          const imgPayload = (await imgRes.json().catch(() => null)) as { formError?: string } | null;
          setClientError(
            imgPayload?.formError ?? `El producto se creó, pero falló la imagen ${i + 1}. Puedes subirla desde su ficha.`,
          );
          setUploadStatus(null);
          setSubmitting(false);
          navigate(createPayload.nextUrl ?? `${window.location.pathname.replace(/\/nuevo$/, "")}/${productId}`);
          return;
        }
      }

      setUploadStatus(null);
      setSubmitting(false);
      navigate(createPayload.nextUrl ?? `${window.location.pathname.replace(/\/nuevo$/, "")}/${productId}`);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "No pudimos completar la creación.");
      setUploadStatus(null);
      setSubmitting(false);
    }
  }

  const currencyOrDefault = product?.currency ?? currency;
  const parsedPrice = useMemo(
    () => parsePriceToMinor(price, currencyOrDefault),
    [price, currencyOrDefault],
  );
  const effectiveSlug = slugTouched ? slug : slugifyCatalogName(name);
  const showError = actionData && actionData.ok === false && actionData.intent === `product-${mode}`;
  const fieldErrors = showError ? actionData.fieldErrors ?? {} : {};

  return (
    <Form method="post" onSubmit={handleCreateWithImages} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="intent" value={mode === "create" ? "create" : "update"} />

      {showError && actionData.formError ? (
        <PanelAlert tone="danger" title="No se guardó el producto">
          <p>{actionData.formError}</p>
        </PanelAlert>
      ) : null}

      {clientError ? (
        <PanelAlert tone="danger" title="Error al crear o subir imágenes">
          <p>{clientError}</p>
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
          <Select
            id={`${id}-category`}
            name="categoryId"
            value={categoryId ?? ""}
            invalid={Boolean(fieldErrors.categoryId)}
            aria-describedby={
              fieldErrors.categoryId ? `${id}-category-error` : `${id}-category-hint`
            }
            onChange={(event) => setCategoryId(event.currentTarget.value)}
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
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
        <Textarea
          id={`${id}-description`}
          name="description"
          value={description}
          maxLength={2000}
          rows={5}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </Field>

      {mode === "create" ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text">Imágenes del producto (opcional)</p>
              <p className="text-xs text-text-muted">
                Hasta {MAX_PRODUCT_IMAGES} fotos (JPG, PNG o WebP, máx. 2 MB c/u). Se optimizan en tu navegador.
              </p>
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-xs font-medium text-text hover:bg-surface-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleSelectImages}
                disabled={submitting || stagedImages.length >= MAX_PRODUCT_IMAGES}
                className="sr-only"
              />
              Elegir imágenes ({stagedImages.length}/{MAX_PRODUCT_IMAGES})
            </label>
          </div>

          {stagedImages.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {stagedImages.map((item, idx) => (
                <li
                  key={item.previewUrl}
                  className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface"
                >
                  <img
                    src={item.previewUrl}
                    alt={`Vista previa ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeStagedImage(idx)}
                    disabled={submitting}
                    aria-label={`Quitar imagen ${idx + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-bg/90 px-1.5 py-0.5 text-[10px] font-semibold text-danger shadow-sm hover:bg-bg"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? (uploadStatus ?? "Guardando...")
            : mode === "create"
              ? "Crear producto"
              : "Guardar cambios"}
        </Button>
        <span className="text-xs text-text-muted">
          {mode === "create"
            ? stagedImages.length > 0
              ? `Se creará el producto y se subirán ${stagedImages.length} ${stagedImages.length === 1 ? "imagen" : "imágenes"}.`
              : "También puedes añadir o reordenar imágenes después desde la ficha."
            : "Las imágenes se gestionan debajo de este formulario."}
        </span>
      </div>
    </Form>
  );
}
