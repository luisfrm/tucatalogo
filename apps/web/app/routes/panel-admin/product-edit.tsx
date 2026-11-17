import {
  deletePanelProduct,
  deletePanelProductImage,
  getPanelProduct,
  listPanelCategories,
  reorderPanelProductImages,
  setPanelProductStatus,
  updatePanelProduct,
  updatePanelProductImage,
  uploadPanelProductImage,
} from "@tucatalogo/api-client";
import {
  productImageFormSchema,
  productUpdateSchema,
  type MediaImage,
  type PanelProduct,
} from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Form, Link, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/product-edit";

import { ProductImageUploader } from "~/components/panel/image-uploaders";
import { ProductForm } from "~/components/panel/product-form";
import {
  FormError,
  PanelAlert,
  PanelCard,
  PanelEmpty,
  PanelFlash,
  PanelPageHeader,
  StatusBadge,
} from "~/components/panel/panel-ui";
import {
  IMAGE_INPUT_MAX_BYTES,
  PRODUCT_IMAGE_LIMIT,
  moveItem,
  panelFlashMessage,
  parsePriceToMinor,
  type PanelActionData,
} from "~/lib/panel";
import { panelActionError, redirectTo, requirePanelContext } from "~/lib/panel.server";
import { productHref, panelHref } from "~/lib/urls";
import { throwApiFailure } from "~/lib/runtime.server";

function apiContextFor(
  context: Awaited<ReturnType<typeof requirePanelContext>>,
  request: Request,
) {
  return {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  const apiContext = apiContextFor(context, request);

  const [product, categories] = await Promise.allSettled([
    getPanelProduct(context.runtime.api, apiContext, params.id),
    listPanelCategories(context.runtime.api, apiContext),
  ]);

  if (product.status === "rejected") {
    throwApiFailure(context.runtime, product.reason, "panel.product_failed");
  }
  if (categories.status === "rejected") {
    throwApiFailure(context.runtime, categories.reason, "panel.product_categories_failed");
  }

  return {
    siteId: context.siteId,
    currency: context.store.currency,
    product: product.value,
    categories: categories.value.items,
    flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const data = matches.at(-1)?.loaderData as { product?: { name?: string } } | undefined;
  return [
    { title: `${data?.product?.name ?? "Producto"} · Panel` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

function failure(intent: string, error: unknown, message: string): PanelActionData {
  return { ok: false, intent, ...panelActionError(error, message) };
}

function imageFromForm(form: FormData, field: string): File | null {
  const value = form.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requirePanelContext(request);
  const apiContext = apiContextFor(context, request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const baseUrl = new URL(request.url);
  const flash = (code: string) => {
    const next = new URL(baseUrl.toString());
    next.searchParams.set("ok", code);
    return `${next.pathname}${next.search}`;
  };

  if (intent === "update") {
    const price = parsePriceToMinor(String(form.get("price") ?? ""), context.store.currency);
    if (!price.ok) {
      return data(
        {
          ok: false as const,
          intent: "product-edit",
          formError: "Revisa los datos del producto.",
          fieldErrors: { priceMinor: price.error },
        },
        { status: 400 },
      );
    }

    const categoryId = String(form.get("categoryId") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const parsed = productUpdateSchema.safeParse({
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      description: description.length > 0 ? description : null,
      priceMinor: price.value,
      categoryId: categoryId.length > 0 ? categoryId : null,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "name";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return data(
        {
          ok: false as const,
          intent: "product-edit",
          formError: "Revisa los datos del producto.",
          fieldErrors,
        },
        { status: 400 },
      );
    }

    try {
      const updated = await updatePanelProduct(context.runtime.api, apiContext, params.id, parsed.data);
      const desired = form.get("isActive");
      if (desired === "true" || desired === "false") {
        const wantActive = desired === "true";
        if (updated.isActive !== wantActive) {
          await setPanelProductStatus(context.runtime.api, apiContext, params.id, {
            isActive: wantActive,
          });
        }
      }
      return redirectTo(flash("product-updated"));
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos actualizar el producto.");
      return data({ ok: false as const, intent: "product-edit", ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "toggle-status") {
    try {
      await setPanelProductStatus(context.runtime.api, apiContext, params.id, {
        isActive: form.get("isActive") === "true",
      });
      return redirectTo(flash("product-status"));
    } catch (error) {
      return data(failure(intent, error, "No pudimos cambiar la visibilidad."), { status: 400 });
    }
  }

  if (intent === "delete-product") {
    if (form.get("confirm") !== "eliminar") {
      return data(
        { ok: false, intent, formError: "Marca la confirmación para eliminar el producto." },
        { status: 400 },
      );
    }
    try {
      await deletePanelProduct(context.runtime.api, apiContext, params.id);
      return redirectTo(panelHref("productos", { siteId: context.siteId, query: { ok: "product-deleted" } }));
    } catch (error) {
      return data(failure(intent, error, "No pudimos eliminar el producto."), { status: 400 });
    }
  }

  if (intent === "upload-image") {
    const full = imageFromForm(form, "full");
    const thumb = imageFromForm(form, "thumb");
    if (!full || !thumb) {
      return data(
        { ok: false, intent, formError: "Falta la imagen o su miniatura. Vuelve a elegir el archivo." },
        { status: 400 },
      );
    }
    if (full.type !== "image/webp" || thumb.type !== "image/webp") {
      return data(
        {
          ok: false,
          intent,
          formError:
            "La imagen debe llegar ya convertida a WebP por el navegador. No aceptamos JPG/PNG directos.",
        },
        { status: 400 },
      );
    }
    if (full.size > IMAGE_INPUT_MAX_BYTES || thumb.size > IMAGE_INPUT_MAX_BYTES) {
      return data(
        { ok: false, intent, formError: "La imagen supera el máximo de 2 MB." },
        { status: 400 },
      );
    }

    const parsedFields = productImageFormSchema.safeParse({
      alt: String(form.get("alt") ?? ""),
      width: form.get("width") ?? undefined,
      height: form.get("height") ?? undefined,
    });
    if (!parsedFields.success) {
      return data(
        {
          ok: false,
          intent,
          formError: parsedFields.error.issues[0]?.message ?? "Revisa el texto alternativo.",
        },
        { status: 400 },
      );
    }

    const upload = new FormData();
    upload.set("full", full, "full.webp");
    upload.set("thumb", thumb, "thumb.webp");
    upload.set("alt", parsedFields.data.alt);
    if (parsedFields.data.width) upload.set("width", String(parsedFields.data.width));
    if (parsedFields.data.height) upload.set("height", String(parsedFields.data.height));

    try {
      await uploadPanelProductImage(context.runtime.api, apiContext, params.id, upload);
      return data({ ok: true as const, intent, message: "Imagen añadida." });
    } catch (error) {
      return data(failure(intent, error, "No pudimos subir la imagen."), { status: 400 });
    }
  }

  if (intent === "delete-image") {
    const imageId = String(form.get("imageId") ?? "");
    if (!imageId || form.get("confirm") !== "eliminar") {
      return data(
        { ok: false, intent, formError: "Confirma la eliminación de la imagen." },
        { status: 400 },
      );
    }
    try {
      await deletePanelProductImage(context.runtime.api, apiContext, params.id, imageId);
      return data({ ok: true as const, intent, message: "Imagen eliminada." });
    } catch (error) {
      return data(failure(intent, error, "No pudimos eliminar la imagen."), { status: 400 });
    }
  }

  if (intent === "update-image") {
    const imageId = String(form.get("imageId") ?? "");
    const alt = String(form.get("alt") ?? "").trim();
    if (!imageId || alt.length === 0) {
      return data(
        { ok: false, intent, formError: "Describe la imagen antes de guardar." },
        { status: 400 },
      );
    }
    try {
      await updatePanelProductImage(context.runtime.api, apiContext, params.id, imageId, { alt });
      return data({ ok: true as const, intent, message: "Texto alternativo actualizado." });
    } catch (error) {
      return data(failure(intent, error, "No pudimos actualizar la imagen."), { status: 400 });
    }
  }

  if (intent === "reorder-images") {
    const imageId = String(form.get("imageId") ?? "");
    const direction = form.get("direction") === "up" ? "up" : "down";
    try {
      const product: PanelProduct = await getPanelProduct(context.runtime.api, apiContext, params.id);
      const next = moveItem(
        product.images.map((image) => image.id),
        imageId,
        direction,
      );
      if (!next) {
        return data(
          { ok: false, intent, formError: "La imagen ya está en el extremo." },
          { status: 400 },
        );
      }
      await reorderPanelProductImages(context.runtime.api, apiContext, params.id, { ids: next });
      return data({ ok: true as const, intent, message: "Orden de imágenes actualizado." });
    } catch (error) {
      return data(failure(intent, error, "No pudimos reordenar las imágenes."), { status: 400 });
    }
  }

  return data({ ok: false, intent, formError: "Acción no reconocida." }, { status: 400 });
}

function ImageRow({
  image,
  index,
  total,
  pending,
}: {
  image: MediaImage;
  index: number;
  total: number;
  pending: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-2">
      <a href={image.fullUrl} target="_blank" rel="noreferrer" className="block">
        <img
          src={image.thumbUrl}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="aspect-square w-full rounded-[var(--radius-sm)] border border-border object-cover"
        />
      </a>
      <p className="truncate text-xs text-text-muted">
        {image.width}×{image.height} px · orden {image.sortOrder}
      </p>

      <Form method="post" className="flex items-end gap-1.5">
        <input type="hidden" name="intent" value="update-image" />
        <input type="hidden" name="imageId" value={image.id} />
        <label className="min-w-0 flex-1 text-xs">
          <span className="mb-0.5 block text-text-muted">Texto alternativo</span>
          <input
            name="alt"
            defaultValue={image.alt}
            maxLength={180}
            required
            className="block h-9 w-full rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-border-strong bg-surface px-2 text-xs focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </label>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          Guardar
        </Button>
      </Form>

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <Form method="post">
            <input type="hidden" name="intent" value="reorder-images" />
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="direction" value="up" />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={pending || index === 0}
              aria-label={`Subir imagen ${index + 1}`}
            >
              ↑
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="reorder-images" />
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="direction" value="down" />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={pending || index === total - 1}
              aria-label={`Bajar imagen ${index + 1}`}
            >
              ↓
            </Button>
          </Form>
        </div>

        <details className="relative">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-[var(--radius-md)] px-2 text-xs font-medium text-danger hover:bg-surface-2">
            Eliminar
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-3 shadow-[var(--shadow-lg)]">
            <Form method="post" className="flex flex-col gap-2">
              <input type="hidden" name="intent" value="delete-image" />
              <input type="hidden" name="imageId" value={image.id} />
              <p className="text-xs">Se borrarán el archivo y su miniatura.</p>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
                Confirmo que quiero eliminar esta imagen.
              </label>
              <Button type="submit" variant="danger" size="sm" disabled={pending}>
                Eliminar imagen
              </Button>
            </Form>
          </div>
        </details>
      </div>
    </li>
  );
}

export default function PanelProductEdit({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const product = loaderData.product;
  const images = product.images;
  const pending = navigation.state === "submitting";
  const error = actionData && "formError" in actionData ? actionData.formError : null;
  const success = actionData && "message" in actionData ? actionData.message : null;

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Catálogo"
        title={product.name}
        description={
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={product.isActive ? "success" : "neutral"}>
              {product.isActive ? "Visible" : "Oculto"}
            </StatusBadge>
            <span className="font-mono text-xs">{product.slug}</span>
            <span>· {images.length} de {PRODUCT_IMAGE_LIMIT} imágenes</span>
          </p>
        }
        actions={
          <>
            <Button asChild variant="secondary" size="md">
              <Link to={panelHref("productos", { siteId: loaderData.siteId })}>Volver</Link>
            </Button>
            <Button asChild variant="ghost" size="md">
              <Link to={productHref(product.slug, { siteId: loaderData.siteId })}>Ver en la tienda</Link>
            </Button>
          </>
        }
      />

      <PanelFlash message={loaderData.flash} />
      {error ? <PanelAlert tone="danger" title="La acción no se completó">{error}</PanelAlert> : null}
      {!error && success ? <PanelAlert tone="success" title={success} /> : null}

      <PanelCard>
        <h2 className="font-heading text-base font-semibold">Datos del producto</h2>
        <div className="mt-3">
          <ProductForm
            mode="edit"
            product={product}
            categories={loaderData.categories}
            currency={loaderData.currency}
            actionData={actionData}
          />
        </div>
      </PanelCard>

      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-semibold">Imágenes</h2>
            <p className="text-sm text-text-muted">
              La primera imagen es la portada del producto en el catálogo.
            </p>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="toggle-status" />
            <input type="hidden" name="isActive" value={product.isActive ? "false" : "true"} />
            <Button type="submit" variant="secondary" size="sm" disabled={pending}>
              {product.isActive ? "Ocultar en la tienda" : "Mostrar en la tienda"}
            </Button>
          </Form>
        </div>

        {images.length === 0 ? (
          <div className="mt-3">
            <PanelEmpty
              title="Sin imágenes todavía"
              description="Sube la primera: se normaliza a WebP full 1600 px y miniatura 600 px en tu navegador."
            />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <ImageRow
                key={image.id}
                image={image}
                index={index}
                total={images.length}
                pending={pending}
              />
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Añadir imagen</h3>
          {images.length >= PRODUCT_IMAGE_LIMIT ? (
            <p className="mt-1 text-sm text-text-muted">
              Este producto ya tiene el máximo de {PRODUCT_IMAGE_LIMIT} imágenes. Elimina una para
              subir otra.
            </p>
          ) : (
            <div className="mt-2">
              <ProductImageUploader
                productName={product.name}
                currentCount={images.length}
                maxImages={PRODUCT_IMAGE_LIMIT}
              />
            </div>
          )}
        </div>
      </PanelCard>

      <PanelCard className="border-danger/40">
        <h2 className="font-heading text-base font-semibold text-danger">Eliminar producto</h2>
        <p className="mt-1 text-sm text-text-muted">
          Es un borrado lógico: el producto deja de mostrarse en la tienda. Las imágenes se
          conservan hasta que elimines la tienda completa.
        </p>
        <details className="mt-3">
          <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-danger/50 bg-surface px-4 text-sm font-medium text-danger hover:bg-surface-2 sm:h-9">
            Quiero eliminar este producto
          </summary>
          <Form method="post" className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="intent" value="delete-product" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
              Confirmo que quiero eliminar “{product.name}” del catálogo.
            </label>
            <div>
              <Button type="submit" variant="danger" size="sm">
                Eliminar producto
              </Button>
            </div>
          </Form>
        </details>
      </PanelCard>

      {actionData && "fieldErrors" in actionData && actionData.fieldErrors ? (
        <div className="sr-only">
          {Object.entries(actionData.fieldErrors).map(([field, message]) => (
            <FormError key={field} message={message} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
