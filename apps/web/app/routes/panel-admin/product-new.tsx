import {
  createPanelProduct,
  listPanelCategories,
  uploadPanelProductImage,
} from "@tucatalogo/api-client";
import { productCreateSchema, productImageFormSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Link, data, useActionData } from "react-router";

import type { Route } from "./+types/product-new";

import { ProductForm } from "~/components/panel/product-form";
import { PanelCard, PanelPageHeader } from "~/components/panel/panel-ui";
import { IMAGE_INPUT_MAX_BYTES, parsePriceToMinor, slugifyCatalogName } from "~/lib/panel";
import {
  panelActionError,
  redirectTo,
  requirePanelContext,
} from "~/lib/panel.server";
import { throwApiFailure } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

  try {
    const categories = await listPanelCategories(context.runtime.api, apiContext);
    return {
      siteId: context.siteId,
      currency: context.store.currency,
      categories: categories.items,
    };
  } catch (error) {
    throwApiFailure(context.runtime, error, "panel.product_new_categories_failed");
  }
}

export function meta() {
  return [
    { title: "Nuevo producto · Panel" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const context = await requirePanelContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "create");
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

  if (intent === "upload-image") {
    const productId = String(form.get("productId") ?? "").trim();
    const full = form.get("full");
    const thumb = form.get("thumb");
    if (!productId || !(full instanceof File) || !(thumb instanceof File) || full.size === 0 || thumb.size === 0) {
      return data(
        { ok: false as const, intent, formError: "Falta la imagen o su miniatura." },
        { status: 400 },
      );
    }
    if (full.type !== "image/webp" || thumb.type !== "image/webp") {
      return data(
        {
          ok: false as const,
          intent,
          formError: "La imagen debe llegar convertida a WebP por el navegador.",
        },
        { status: 400 },
      );
    }
    if (full.size > IMAGE_INPUT_MAX_BYTES || thumb.size > IMAGE_INPUT_MAX_BYTES) {
      return data(
        { ok: false as const, intent, formError: "La imagen supera el máximo de 2 MB." },
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
          ok: false as const,
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
      await uploadPanelProductImage(context.runtime.api, apiContext, productId, upload);
      return data({ ok: true as const, intent });
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos subir la imagen.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  const name = String(form.get("name") ?? "").trim();
  const rawSlug = String(form.get("slug") ?? "").trim();
  const priceText = String(form.get("price") ?? "");
  const categoryId = String(form.get("categoryId") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  const price = parsePriceToMinor(priceText, context.store.currency);
  if (!price.ok) {
    return data(
      {
        ok: false as const,
        intent: "product-create",
        formError: "Revisa los datos del producto.",
        fieldErrors: { priceMinor: price.error },
      },
      { status: 400 },
    );
  }

  const parsed = productCreateSchema.safeParse({
    name,
    slug: rawSlug || slugifyCatalogName(name),
    description: description.length > 0 ? description : null,
    priceMinor: price.value,
    categoryId: categoryId.length > 0 ? categoryId : null,
    isActive: form.get("isActive") !== "false",
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
        intent: "product-create",
        formError: "Revisa los datos del producto.",
        fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const product = await createPanelProduct(context.runtime.api, apiContext, parsed.data);
    const nextUrl = panelHref(`productos/${product.id}`, {
      siteId: context.siteId,
      query: { ok: "product-created" },
    });
    if (form.get("responseMode") === "json") {
      return data({
        ok: true as const,
        intent: "product-create",
        productId: product.id,
        nextUrl,
      });
    }
    return redirectTo(nextUrl);
  } catch (error) {
    const mapped = panelActionError(error, "No pudimos crear el producto.");
    return data(
      { ok: false as const, intent: "product-create", ...mapped },
      { status: mapped.status },
    );
  }
}

export default function PanelProductNew({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Catálogo"
        title="Nuevo producto"
        description="El identificador se genera del nombre, pero puedes cambiarlo antes de guardar."
        actions={
          <Button asChild variant="secondary" size="md">
            <Link to={panelHref("productos", { siteId: loaderData.siteId })}>Volver</Link>
          </Button>
        }
      />

      <PanelCard>
        <ProductForm
          mode="create"
          categories={loaderData.categories}
          currency={loaderData.currency}
          actionData={actionData}
        />
      </PanelCard>

      <PanelCard as="div" className="bg-surface-2">
        <h2 className="font-heading text-sm font-semibold">Sobre las imágenes</h2>
        <p className="mt-1 text-sm text-text-muted">
          Puedes adjuntar hasta 8 imágenes directamente arriba (se normalizan a WebP 1600 px + miniatura
          600 px en tu navegador) o gestionarlas luego desde la ficha del producto.
        </p>
      </PanelCard>
    </div>
  );
}
