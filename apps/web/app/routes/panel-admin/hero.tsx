import {
  createPanelHero,
  deletePanelHero,
  listPanelHero,
  reorderPanelHero,
  replacePanelHeroImages,
  updatePanelHero,
} from "@tucatalogo/api-client";
import { ctaUrlSchema, heroUpdateSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { Form, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/hero";

import { HeroCreateForm, HeroImagesForm } from "~/components/panel/image-uploaders";
import {
  Field,
  PanelAlert,
  PanelCard,
  PanelEmpty,
  PanelFlash,
  PanelPageHeader,
  StatusBadge,
} from "~/components/panel/panel-ui";
import {
  HERO_SLIDE_LIMIT,
  IMAGE_INPUT_MAX_BYTES,
  moveItem,
  panelFlashMessage,
  type PanelActionData,
} from "~/lib/panel";
import { panelActionError, redirectTo, requirePanelContext } from "~/lib/panel.server";
import { throwApiFailure } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

function imageFromForm(form: FormData, field: string): File | null {
  const value = form.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

function validateHeroFile(file: File | null, field: string): string | null {
  if (!file) return `Falta la imagen de ${field}.`;
  if (file.type !== "image/webp") {
    return `La imagen de ${field} debe llegar ya normalizada a WebP por el navegador.`;
  }
  if (file.size > IMAGE_INPUT_MAX_BYTES) return `La imagen de ${field} supera los 2 MB.`;
  return null;
}

function ctaError(label: string, url: string): string | null {
  const hasLabel = label.trim().length > 0;
  const hasUrl = url.trim().length > 0;
  if (hasLabel !== hasUrl) {
    return "El botón necesita texto y enlace, o ninguno de los dos.";
  }
  if (hasUrl) {
    const parsed = ctaUrlSchema.safeParse(url.trim());
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "El enlace no es válido.";
  }
  return null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  try {
    const hero = await listPanelHero(context.runtime.api, {
      storeSlug: context.slug,
      cookie: context.cookie,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });
    return {
      siteId: context.siteId,
      items: hero.items,
      limit: hero.limit || HERO_SLIDE_LIMIT,
      flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
    };
  } catch (error) {
    throwApiFailure(context.runtime, error, "panel.hero_failed");
  }
}

export function meta() {
  return [
    { title: "Hero · Panel" },
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
    redirectTo(panelHref("hero", { siteId: context.siteId, query: { ok: code } }));
  const failure = (error: unknown, message: string): PanelActionData => ({
    ok: false,
    intent,
    ...panelActionError(error, message),
  });

  if (intent === "create-hero") {
    const desktop = imageFromForm(form, "desktop");
    const mobile = imageFromForm(form, "mobile");
    const fileError =
      validateHeroFile(desktop, "escritorio") ?? validateHeroFile(mobile, "móvil");
    if (fileError) {
      return data({ ok: false as const, intent, formError: fileError }, { status: 400 });
    }

    const title = String(form.get("title") ?? "").trim();
    const subtitle = String(form.get("subtitle") ?? "").trim();
    const ctaLabel = String(form.get("ctaLabel") ?? "").trim();
    const ctaUrl = String(form.get("ctaUrl") ?? "").trim();
    const cta = ctaError(ctaLabel, ctaUrl);
    if (cta) return data({ ok: false as const, intent, formError: cta }, { status: 400 });

    const upload = new FormData();
    upload.set("desktop", desktop!, "desktop.webp");
    upload.set("mobile", mobile!, "mobile.webp");
    if (title) upload.set("title", title.slice(0, 120));
    if (subtitle) upload.set("subtitle", subtitle.slice(0, 200));
    if (ctaLabel) upload.set("ctaLabel", ctaLabel.slice(0, 40));
    if (ctaUrl) upload.set("ctaUrl", ctaUrl.slice(0, 500));
    upload.set("isActive", form.get("isActive") === "false" ? "false" : "true");

    try {
      await createPanelHero(context.runtime.api, apiContext, upload);
      return data({ ok: true as const, intent, message: "Slide añadido al hero." });
    } catch (error) {
      return data(failure(error, "No pudimos crear el slide."), { status: 400 });
    }
  }

  if (intent === "update-hero") {
    const slideId = String(form.get("slideId") ?? "");
    const ctaLabel = String(form.get("ctaLabel") ?? "").trim();
    const ctaUrl = String(form.get("ctaUrl") ?? "").trim();
    const cta = ctaError(ctaLabel, ctaUrl);
    if (cta) return data({ ok: false as const, intent, formError: cta }, { status: 400 });

    const title = String(form.get("title") ?? "").trim();
    const subtitle = String(form.get("subtitle") ?? "").trim();
    const parsed = heroUpdateSchema.safeParse({
      title: title.length > 0 ? title : null,
      subtitle: subtitle.length > 0 ? subtitle : null,
      ctaLabel: ctaLabel.length > 0 ? ctaLabel : null,
      ctaUrl: ctaUrl.length > 0 ? ctaUrl : null,
      isActive: form.get("isActive") === "true",
    });

    if (!slideId || !parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: parsed.success
            ? "No encontramos el slide."
            : (parsed.error.issues[0]?.message ?? "Revisa los datos del slide."),
        },
        { status: 400 },
      );
    }

    try {
      await updatePanelHero(context.runtime.api, apiContext, slideId, parsed.data);
      return flash("hero-updated");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos actualizar el slide.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "toggle-hero") {
    const slideId = String(form.get("slideId") ?? "");
    if (!slideId) return data({ ok: false, intent, formError: "No encontramos el slide." }, { status: 400 });
    try {
      await updatePanelHero(context.runtime.api, apiContext, slideId, {
        isActive: form.get("isActive") === "true",
      });
      return flash("hero-updated");
    } catch (error) {
      return data(failure(error, "No pudimos cambiar la visibilidad del slide."), { status: 400 });
    }
  }

  if (intent === "delete-hero") {
    const slideId = String(form.get("slideId") ?? "");
    if (!slideId || form.get("confirm") !== "eliminar") {
      return data({ ok: false, intent, formError: "Confirma la eliminación del slide." }, { status: 400 });
    }
    try {
      await deletePanelHero(context.runtime.api, apiContext, slideId);
      return flash("hero-deleted");
    } catch (error) {
      return data(failure(error, "No pudimos eliminar el slide."), { status: 400 });
    }
  }

  if (intent === "reorder-hero") {
    const slideId = String(form.get("slideId") ?? "");
    const direction = form.get("direction") === "up" ? "up" : "down";
    try {
      const hero = await listPanelHero(context.runtime.api, apiContext);
      const next = moveItem(
        hero.items.map((slide) => slide.id),
        slideId,
        direction,
      );
      if (!next) {
        return data({ ok: false, intent, formError: "El slide ya está en el extremo." }, { status: 400 });
      }
      await reorderPanelHero(context.runtime.api, apiContext, { ids: next });
      return flash("hero-reordered");
    } catch (error) {
      return data(failure(error, "No pudimos reordenar el hero."), { status: 400 });
    }
  }

  if (intent === "replace-hero-images") {
    const slideId = String(form.get("slideId") ?? "");
    const desktop = imageFromForm(form, "desktop");
    const mobile = imageFromForm(form, "mobile");
    const fileError =
      validateHeroFile(desktop, "escritorio") ?? validateHeroFile(mobile, "móvil");
    if (!slideId || fileError) {
      return data(
        { ok: false as const, intent, formError: fileError ?? "No encontramos el slide." },
        { status: 400 },
      );
    }
    const upload = new FormData();
    upload.set("desktop", desktop!, "desktop.webp");
    upload.set("mobile", mobile!, "mobile.webp");
    try {
      await replacePanelHeroImages(context.runtime.api, apiContext, slideId, upload);
      return data({ ok: true as const, intent, message: "Imágenes del slide reemplazadas." });
    } catch (error) {
      return data(failure(error, "No pudimos reemplazar las imágenes."), { status: 400 });
    }
  }

  return data({ ok: false, intent, formError: "Acción no reconocida." }, { status: 400 });
}

export default function PanelHero({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const error = actionData && "formError" in actionData ? actionData.formError : null;
  const canCreate = loaderData.items.length < loaderData.limit;

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Portada"
        title="Hero"
        description={
          <p>
            {loaderData.items.length} de {loaderData.limit} slides. Cada slide necesita una imagen
            de escritorio (1600 × 900) y otra de móvil (900 × 1200), con recorte centrado.
          </p>
        }
      />

      <PanelFlash message={loaderData.flash} />
      {error ? <PanelAlert tone="danger" title="La acción no se completó">{error}</PanelAlert> : null}

      <PanelCard>
        <h2 className="font-heading text-base font-semibold">Añadir slide</h2>
        {canCreate ? (
          <div className="mt-3">
            <HeroCreateForm
              disabled={pending}
              defaults={{ title: "", subtitle: "", ctaLabel: "", ctaUrl: "" }}
            />
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            Alcanzaste el máximo de {loaderData.limit} slides. Elimina uno para añadir otro.
          </p>
        )}
      </PanelCard>

      {loaderData.items.length === 0 ? (
        <PanelEmpty
          title="El hero está vacío"
          description="La tienda mostrará solo el catálogo. Añade un slide para destacar una campaña."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {loaderData.items.map((slide, index) => (
            <li key={slide.id}>
              <PanelCard as="article" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {slide.title ?? "Slide sin título"}{" "}
                      <span className="text-xs text-text-muted">#{index + 1}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={slide.isActive ? "success" : "neutral"}>
                        {slide.isActive ? "Visible" : "Oculto"}
                      </StatusBadge>
                      {slide.ctaLabel ? (
                        <span className="text-xs text-text-muted">
                          CTA: {slide.ctaLabel} → {slide.ctaUrl}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Sin botón</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Form method="post">
                      <input type="hidden" name="intent" value="reorder-hero" />
                      <input type="hidden" name="slideId" value={slide.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={pending || index === 0}
                        aria-label="Subir slide"
                      >
                        ↑
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="reorder-hero" />
                      <input type="hidden" name="slideId" value={slide.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={pending || index === loaderData.items.length - 1}
                        aria-label="Bajar slide"
                      >
                        ↓
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle-hero" />
                      <input type="hidden" name="slideId" value={slide.id} />
                      <input type="hidden" name="isActive" value={slide.isActive ? "false" : "true"} />
                      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                        {slide.isActive ? "Ocultar" : "Mostrar"}
                      </Button>
                    </Form>
                    <details className="relative">
                      <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-danger hover:bg-surface-2 sm:h-9">
                        Eliminar
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-72 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border bg-surface p-3 shadow-[var(--shadow-lg)]">
                        <Form method="post" className="flex flex-col gap-2">
                          <input type="hidden" name="intent" value="delete-hero" />
                          <input type="hidden" name="slideId" value={slide.id} />
                          <p className="text-sm">Se borrarán las dos imágenes del slide.</p>
                          <label className="flex items-start gap-2 text-xs">
                            <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
                            Confirmo que quiero eliminar este slide.
                          </label>
                          <Button type="submit" variant="danger" size="sm" disabled={pending}>
                            Eliminar slide
                          </Button>
                        </Form>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <figure>
                    <img
                      src={slide.desktopUrl}
                      alt={slide.title ?? "Vista de escritorio del slide"}
                      className="aspect-video w-full rounded-[var(--radius-sm)] border border-border object-cover"
                    />
                    <figcaption className="mt-1 text-xs text-text-muted">Escritorio</figcaption>
                  </figure>
                  <figure>
                    <img
                      src={slide.mobileUrl}
                      alt={slide.title ?? "Vista móvil del slide"}
                      className="mx-auto aspect-[3/4] w-full max-w-40 rounded-[var(--radius-sm)] border border-border object-cover"
                    />
                    <figcaption className="mt-1 text-xs text-text-muted">Móvil</figcaption>
                  </figure>
                </div>

                <details>
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Editar textos, botón y visibilidad
                  </summary>
                  <Form method="post" className="mt-2 flex flex-col gap-3" noValidate>
                    <input type="hidden" name="intent" value="update-hero" />
                    <input type="hidden" name="slideId" value={slide.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id={`hero-title-${slide.id}`} label="Título">
                        <input
                          id={`hero-title-${slide.id}`}
                          name="title"
                          defaultValue={slide.title ?? ""}
                          maxLength={120}
                          className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                        />
                      </Field>
                      <Field id={`hero-subtitle-${slide.id}`} label="Subtítulo">
                        <input
                          id={`hero-subtitle-${slide.id}`}
                          name="subtitle"
                          defaultValue={slide.subtitle ?? ""}
                          maxLength={200}
                          className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                        />
                      </Field>
                      <Field id={`hero-cta-label-${slide.id}`} label="Texto del botón">
                        <input
                          id={`hero-cta-label-${slide.id}`}
                          name="ctaLabel"
                          defaultValue={slide.ctaLabel ?? ""}
                          maxLength={40}
                          className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                        />
                      </Field>
                      <Field
                        id={`hero-cta-url-${slide.id}`}
                        label="Enlace del botón"
                        hint="https://… o ruta interna /…"
                      >
                        <input
                          id={`hero-cta-url-${slide.id}`}
                          name="ctaUrl"
                          defaultValue={slide.ctaUrl ?? ""}
                          maxLength={500}
                          className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="isActive"
                        value="true"
                        defaultChecked={slide.isActive}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      Visible en la tienda
                    </label>
                    <div>
                      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                        Guardar slide
                      </Button>
                    </div>
                  </Form>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Reemplazar imágenes
                  </summary>
                  <div className="mt-2">
                    <HeroImagesForm slideId={slide.id} />
                  </div>
                </details>
              </PanelCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
