import {
  deletePanelProduct,
  listPanelCategories,
  listPanelProducts,
  reorderPanelProducts,
  setPanelProductStatus,
} from "@tucatalogo/api-client";
import type { PanelProductList, ProductStatusInput, ReorderInput } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Form, Link, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/products";

import {
  Field,
  FormError,
  PanelAlert,
  PanelCard,
  PanelEmpty,
  PanelFlash,
  PanelPageHeader,
  PanelPagination,
  StatusBadge,
} from "~/components/panel/panel-ui";
import {
  PANEL_PAGE_SIZE,
  moveItem,
  panelFlashMessage,
  productStatusLabel,
  readPanelProductsQuery,
  withFlash,
  type PanelActionData,
} from "~/lib/panel";
import { panelActionError, requirePanelContext } from "~/lib/panel.server";
import { formatStorePrice } from "~/lib/price";
import { throwApiFailure } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

async function allProductIds(
  context: Awaited<ReturnType<typeof requirePanelContext>>,
  request: Request,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

  // El contrato de `reorder` exige el conjunto exacto de ids de la tienda.
  for (;;) {
    const list = await listPanelProducts(context.runtime.api, apiContext, {
      status: "all",
      page,
      q: undefined,
      category: undefined,
    });
    ids.push(...list.items.map((item) => item.id));
    if (!list.hasMore || page >= 50) break;
    page += 1;
  }

  return ids;
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  const query = readPanelProductsQuery(new URL(request.url));
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

  const [products, categories] = await Promise.allSettled([
    listPanelProducts(context.runtime.api, apiContext, {
      q: query.q || undefined,
      category: query.category || undefined,
      status: query.status,
      page: query.page,
    }),
    listPanelCategories(context.runtime.api, apiContext),
  ]);

  if (products.status === "rejected") {
    throwApiFailure(context.runtime, products.reason, "panel.products_failed");
  }
  if (categories.status === "rejected") {
    throwApiFailure(context.runtime, categories.reason, "panel.categories_failed");
  }

  const list: PanelProductList = products.value;
  return {
    siteId: context.siteId,
    currency: context.store.currency,
    query,
    page: list.page,
    pageSize: list.pageSize || PANEL_PAGE_SIZE,
    total: list.total,
    hasMore: list.hasMore,
    items: list.items.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      priceLabel: formatStorePrice(product.priceMinor, product.currency),
      categoryId: product.categoryId,
      thumbUrl: product.images[0]?.thumbUrl ?? null,
      imageCount: product.images.length,
    })),
    categories: categories.value.items.map((category) => ({
      id: category.id,
      name: category.name,
      productCount: category.productCount,
    })),
    flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const data = matches.at(-1)?.loaderData as { siteId?: string } | undefined;
  void data;
  return [
    { title: "Productos · Panel" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const context = await requirePanelContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const productId = String(form.get("productId") ?? "");
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };
  const flashUrl = (code: string) => withFlash(new URL(request.url), code);
  const failure = (error: unknown, message: string): PanelActionData => ({
    ok: false,
    intent,
    ...panelActionError(error, message),
  });

  if (intent === "toggle") {
    if (!productId) return data(failure(new Error("missing id"), "No encontramos el producto."), { status: 400 });
    const input: ProductStatusInput = { isActive: form.get("isActive") === "true" };
    try {
      await setPanelProductStatus(context.runtime.api, apiContext, productId, input);
      return new Response(null, { status: 303, headers: { location: flashUrl("product-status") } });
    } catch (error) {
      return data(failure(error, "No pudimos cambiar la visibilidad del producto."), { status: 400 });
    }
  }

  if (intent === "delete") {
    if (!productId) return data(failure(new Error("missing id"), "No encontramos el producto."), { status: 400 });
    if (form.get("confirm") !== "eliminar") {
      return data(
        { ok: false, intent, formError: "Marca la confirmación para eliminar el producto." },
        { status: 400 },
      );
    }
    try {
      await deletePanelProduct(context.runtime.api, apiContext, productId);
      return new Response(null, { status: 303, headers: { location: flashUrl("product-deleted") } });
    } catch (error) {
      return data(failure(error, "No pudimos eliminar el producto."), { status: 400 });
    }
  }

  if (intent === "reorder") {
    const direction = form.get("direction") === "up" ? "up" : "down";
    if (!productId) return data(failure(new Error("missing id"), "No encontramos el producto."), { status: 400 });
    try {
      const ids = await allProductIds(context, request);
      const next = moveItem(ids, productId, direction);
      if (!next) {
        return data(
          { ok: false, intent, formError: "El producto ya está en el extremo del listado." },
          { status: 400 },
        );
      }
      const input: ReorderInput = { ids: next };
      await reorderPanelProducts(context.runtime.api, apiContext, input);
      return new Response(null, { status: 303, headers: { location: flashUrl("product-reordered") } });
    } catch (error) {
      return data(failure(error, "No pudimos reordenar los productos."), { status: 400 });
    }
  }

  return data({ ok: false, intent, formError: "Acción no reconocida." }, { status: 400 });
}

export default function PanelProducts({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const { query, categories, items, page, pageSize, total, hasMore, siteId, flash } = loaderData;
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const hasFilters = Boolean(query.q || query.category || query.status !== "all");
  const actionError = actionData && "formError" in actionData ? actionData.formError : null;
  const outOfRange = items.length === 0 && total > 0 && page > 1;

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Catálogo"
        title="Productos"
        description={
          <p>
            {total} {total === 1 ? "producto" : "productos"}. Los ocultos no aparecen en la
            tienda; el borrado es lógico y conserva las imágenes hasta eliminar la tienda.
          </p>
        }
        actions={
          <Button asChild size="md">
            <Link to={panelHref("productos/nuevo", { siteId })}>Nuevo producto</Link>
          </Button>
        }
      />

      <PanelFlash message={flash} />
      {actionError ? <PanelAlert tone="danger" title="La acción no se completó">{actionError}</PanelAlert> : null}

      <PanelCard as="div">
        <Form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Field id="products-q" label="Buscar">
            <input
              id="products-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Nombre o identificador"
              className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-base sm:text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            />
          </Field>
          <Field id="products-category" label="Categoría">
            <select
              id="products-category"
              name="category"
              defaultValue={query.category}
              className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-base sm:text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.productCount})
                </option>
              ))}
            </select>
          </Field>
          <Field id="products-status" label="Estado">
            <select
              id="products-status"
              name="status"
              defaultValue={query.status}
              className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-base sm:text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <option value="all">Todos</option>
              <option value="active">Visibles</option>
              <option value="inactive">Ocultos</option>
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" size="md">Filtrar</Button>
            {hasFilters ? (
              <Button asChild variant="ghost" size="md">
                <Link to={panelHref("productos", { siteId })}>Limpiar</Link>
              </Button>
            ) : null}
          </div>
        </Form>
      </PanelCard>

      {items.length === 0 ? (
        outOfRange ? (
          <PanelEmpty
            title="Esta página no tiene productos"
            description="Te has pasado de la última página de resultados."
            action={
              <Button asChild variant="secondary">
                <Link to={panelHref("productos", { siteId })}>Ir a la primera página</Link>
              </Button>
            }
          />
        ) : hasFilters ? (
          <PanelEmpty
            title="Sin resultados"
            description={`No hay productos para “${query.q || "tu búsqueda"}” con esos filtros.`}
            action={
              <Button asChild variant="secondary">
                <Link to={panelHref("productos", { siteId })}>Quitar filtros</Link>
              </Button>
            }
          />
        ) : (
          <PanelEmpty
            title="Todavía no hay productos"
            description="Crea el primero para que aparezca en la tienda y se pueda pedir por WhatsApp."
            action={
              <Button asChild>
                <Link to={panelHref("productos/nuevo", { siteId })}>Crear producto</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-border bg-surface sm:block">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">Productos de la tienda</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">Producto</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Precio</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Categoría</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Orden</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product, index) => {
                  const isFirst = page === 1 && index === 0;
                  const isLast = !hasMore && index === items.length - 1;
                  return (
                    <tr key={product.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.thumbUrl ? (
                            <img
                              src={product.thumbUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="size-10 rounded-[var(--radius-sm)] border border-border object-cover"
                            />
                          ) : (
                            <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] border border-dashed border-border-strong text-[10px] text-text-muted">
                              Sin foto
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{product.name}</span>
                            <span className="block truncate font-mono text-xs text-text-muted">
                              {product.slug}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{product.priceLabel}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {product.categoryId ? categoryById.get(product.categoryId) ?? "—" : "Sin categoría"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={product.isActive ? "success" : "neutral"}>
                          {productStatusLabel(product.isActive)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Form method="post">
                            <input type="hidden" name="intent" value="reorder" />
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              disabled={pending || isFirst}
                              aria-label={`Subir ${product.name}`}
                            >
                              ↑
                            </Button>
                          </Form>
                          <Form method="post">
                            <input type="hidden" name="intent" value="reorder" />
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="direction" value="down" />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              disabled={pending || isLast}
                              aria-label={`Bajar ${product.name}`}
                            >
                              ↓
                            </Button>
                          </Form>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button asChild variant="secondary" size="sm">
                            <Link to={panelHref(`productos/${product.id}`, { siteId })}>Editar</Link>
                          </Button>
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggle" />
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="isActive" value={product.isActive ? "false" : "true"} />
                            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                              {product.isActive ? "Ocultar" : "Mostrar"}
                            </Button>
                          </Form>
                          <details className="relative">
                            <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-danger hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:h-9">
                              Eliminar
                            </summary>
                            <div className="absolute right-0 z-20 mt-1 w-72 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-3 shadow-[var(--shadow-lg)]">
                              <Form method="post" className="flex flex-col gap-2">
                                <input type="hidden" name="intent" value="delete" />
                                <input type="hidden" name="productId" value={product.id} />
                                <p className="text-sm">
                                  Se ocultará “{product.name}” del catálogo. Es un borrado lógico.
                                </p>
                                <label className="flex items-start gap-2 text-xs">
                                  <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
                                  Confirmo que quiero eliminar este producto.
                                </label>
                                <Button type="submit" variant="danger" size="sm" disabled={pending}>
                                  Eliminar producto
                                </Button>
                              </Form>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 sm:hidden">
            {items.map((product) => (
              <li key={product.id}>
                <PanelCard as="article" className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {product.thumbUrl ? (
                      <img
                        src={product.thumbUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 rounded-[var(--radius-sm)] border border-border object-cover"
                      />
                    ) : (
                      <span className="grid size-14 place-items-center rounded-[var(--radius-sm)] border border-dashed border-border-strong text-[10px] text-text-muted">
                        Sin foto
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="truncate font-mono text-xs text-text-muted">{product.slug}</p>
                      <p className="mt-0.5 text-sm tabular-nums">{product.priceLabel}</p>
                    </div>
                    <StatusBadge tone={product.isActive ? "success" : "neutral"}>
                      {productStatusLabel(product.isActive)}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-text-muted">
                    {product.categoryId ? categoryById.get(product.categoryId) ?? "Sin categoría" : "Sin categoría"} ·{" "}
                    {product.imageCount} {product.imageCount === 1 ? "imagen" : "imágenes"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link to={panelHref(`productos/${product.id}`, { siteId })}>Editar</Link>
                    </Button>
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="isActive" value={product.isActive ? "false" : "true"} />
                      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                        {product.isActive ? "Ocultar" : "Mostrar"}
                      </Button>
                    </Form>
                  </div>
                </PanelCard>
              </li>
            ))}
          </ul>

          <PanelPagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="productos"
            query={{ q: query.q, category: query.category, status: query.status }}
            siteId={siteId}
          />
        </>
      )}

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
