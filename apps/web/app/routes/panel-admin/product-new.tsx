import { createPanelProduct, listPanelCategories } from "@tucatalogo/api-client";
import { productCreateSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Link, data, useActionData } from "react-router";

import type { Route } from "./+types/product-new";

import { ProductForm } from "~/components/panel/product-form";
import { PanelCard, PanelPageHeader } from "~/components/panel/panel-ui";
import { parsePriceToMinor, slugifyCatalogName } from "~/lib/panel";
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
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

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
    return redirectTo(
      panelHref(`productos/${product.id}`, {
        siteId: context.siteId,
        query: { ok: "product-created" },
      }),
    );
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
          Crea el producto primero: las imágenes se suben desde su ficha, hasta 8 por producto y
          normalizadas a WebP en tu navegador (full 1600 px + miniatura 600 px).
        </p>
      </PanelCard>
    </div>
  );
}
