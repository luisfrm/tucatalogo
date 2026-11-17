import {
  createPanelCategory,
  deletePanelCategory,
  listPanelCategories,
  updatePanelCategory,
} from "@tucatalogo/api-client";
import { categoryCreateSchema, categoryUpdateSchema } from "@tucatalogo/types";
import { Button, Input } from "@tucatalogo/ui";
import { Form, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/categories";

import {
  Field,
  PanelAlert,
  PanelCard,
  PanelEmpty,
  PanelFlash,
  PanelPageHeader,
} from "~/components/panel/panel-ui";
import { panelFlashMessage, type PanelActionData } from "~/lib/panel";import {
  panelActionError,
  redirectTo,
  requirePanelContext,
} from "~/lib/panel.server";
import { throwApiFailure } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

function errorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "name";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  try {
    const categories = await listPanelCategories(context.runtime.api, {
      storeSlug: context.slug,
      cookie: context.cookie,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });
    return {
      siteId: context.siteId,
      items: categories.items,
      flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
    };
  } catch (error) {
    throwApiFailure(context.runtime, error, "panel.categories_failed");
  }
}

export function meta() {
  return [
    { title: "Categorías · Panel" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const context = await requirePanelContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };
  const flash = (code: string) =>
    redirectTo(panelHref("categorias", { siteId: context.siteId, query: { ok: code } }));

  if (intent === "create") {
    const parsed = categoryCreateSchema.safeParse({
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
    });
    if (!parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: "Revisa los datos de la categoría.",
          fieldErrors: errorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }
    try {
      await createPanelCategory(context.runtime.api, apiContext, parsed.data);
      return flash("category-created");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos crear la categoría.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "update") {
    const categoryId = String(form.get("categoryId") ?? "");
    const parsed = categoryUpdateSchema.safeParse({
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
    });
    if (!categoryId || !parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: "Revisa los datos de la categoría.",
          fieldErrors: parsed.success ? {} : errorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }
    try {
      await updatePanelCategory(context.runtime.api, apiContext, categoryId, parsed.data);
      return flash("category-updated");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos actualizar la categoría.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "delete") {
    const categoryId = String(form.get("categoryId") ?? "");
    if (!categoryId || form.get("confirm") !== "eliminar") {
      return data(
        { ok: false, intent, formError: "Confirma la eliminación de la categoría." },
        { status: 400 },
      );
    }
    try {
      await deletePanelCategory(context.runtime.api, apiContext, categoryId);
      return flash("category-deleted");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos eliminar la categoría.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  return data({ ok: false, intent, formError: "Acción no reconocida." }, { status: 400 });
}

export default function PanelCategories({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<PanelActionData>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const error = actionData?.formError;
  const fieldErrors = actionData?.fieldErrors ?? {};
  const totalProducts = loaderData.items.reduce((sum, category) => sum + category.productCount, 0);

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Catálogo"
        title="Categorías"
        description={
          <p>
            {loaderData.items.length} {loaderData.items.length === 1 ? "categoría" : "categorías"} ·{" "}
            {totalProducts} productos asignados. El identificador es único dentro de tu tienda.
          </p>
        }
      />

      <PanelFlash message={loaderData.flash} />
      {error ? <PanelAlert tone="danger" title="La acción no se completó">{error}</PanelAlert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <PanelCard>
          <h2 className="font-heading text-base font-semibold">Nueva categoría</h2>
          <Form method="post" className="mt-3 flex flex-col gap-3" noValidate>
            <input type="hidden" name="intent" value="create" />
            <Field id="category-name" label="Nombre" error={fieldErrors.name} required>
              <Input
                id="category-name"
                name="name"
                maxLength={80}
                required
                invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "category-name-error" : undefined}
              />
            </Field>
            <Field
              id="category-slug"
              label="Identificador"
              error={fieldErrors.slug}
              hint="Minúsculas, números y guiones. Ej.: sandalias."
              required
            >
              <Input
                id="category-slug"
                name="slug"
                maxLength={63}
                required
                invalid={Boolean(fieldErrors.slug)}
                aria-describedby={fieldErrors.slug ? "category-slug-error" : "category-slug-hint"}
                className="font-mono"
              />
            </Field>
            <div>
              <Button type="submit" disabled={pending}>
                Crear categoría
              </Button>
            </div>
          </Form>
        </PanelCard>

        <div className="flex flex-col gap-3">
          {loaderData.items.length === 0 ? (
            <PanelEmpty
              title="Sin categorías"
              description="Agrupa tus productos por tipo para que el catálogo sea más fácil de recorrer."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {loaderData.items.map((category) => (
                <li key={category.id}>
                  <PanelCard as="article">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{category.name}</p>
                        <p className="truncate font-mono text-xs text-text-muted">{category.slug}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {category.productCount}{" "}
                          {category.productCount === 1 ? "producto" : "productos"}
                        </p>
                      </div>
                      <details className="relative">
                        <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-danger hover:bg-surface-2 sm:h-9">
                          Eliminar
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-72 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-3 shadow-[var(--shadow-lg)]">
                          <Form method="post" className="flex flex-col gap-2">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="categoryId" value={category.id} />
                            <p className="text-sm">
                              Eliminar “{category.name}” deja {category.productCount} productos sin
                              categoría. No se borran productos.
                            </p>
                            <label className="flex items-start gap-2 text-xs">
                              <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
                              Confirmo que quiero eliminar esta categoría.
                            </label>
                            <Button type="submit" variant="danger" size="sm" disabled={pending}>
                              Eliminar categoría
                            </Button>
                          </Form>
                        </div>
                      </details>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        Editar nombre o identificador
                      </summary>
                      <Form method="post" className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <input type="hidden" name="intent" value="update" />
                        <input type="hidden" name="categoryId" value={category.id} />
                        <Field id={`category-name-${category.id}`} label="Nombre" className="flex-1">
                          <Input
                            id={`category-name-${category.id}`}
                            name="name"
                            defaultValue={category.name}
                            maxLength={80}
                            required
                          />
                        </Field>
                        <Field id={`category-slug-${category.id}`} label="Identificador" className="flex-1">
                          <Input
                            id={`category-slug-${category.id}`}
                            name="slug"
                            defaultValue={category.slug}
                            maxLength={63}
                            required
                            className="font-mono"
                          />
                        </Field>
                        <div>
                          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                            Guardar
                          </Button>
                        </div>
                      </Form>
                    </details>
                  </PanelCard>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
