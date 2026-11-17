import {
  deletePanelStore,
  reactivatePanelStore,
  suspendPanelStore,
  updatePanelStore,
  uploadStoreLogo,
} from "@tucatalogo/api-client";
import {
  panelDeleteStoreSchema,
  panelStoreUpdateSchema,
  panelSuspendStoreSchema,
} from "@tucatalogo/types";
import {
  FONT_BASE_PATH,
  listThemeMetadata,
  renderFontFaceCss,
} from "@tucatalogo/themes";
import { Button, Input } from "@tucatalogo/ui";
import { Form, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/settings";

import { LogoUploader } from "~/components/panel/image-uploaders";
import { SettingsForm } from "~/components/panel/settings-form";
import {
  Field,
  FormError,
  PanelAlert,
  PanelCard,
  PanelFlash,
  PanelPageHeader,
  StatusBadge,
} from "~/components/panel/panel-ui";
import {
  IMAGE_INPUT_MAX_BYTES,
  panelFlashMessage,
  type PanelActionData,
} from "~/lib/panel";
import {
  panelActionError,
  redirectTo,
  requirePanelContext,
} from "~/lib/panel.server";
import { fail } from "~/lib/runtime.server";
import { buildThemePreviewCss } from "~/lib/theme-preview";
import { panelHref } from "~/lib/urls";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  const themes = listThemeMetadata();

  let previewCss: string;
  try {
    previewCss = buildThemePreviewCss(themes, context.store.primaryColor);
  } catch (error) {
    fail(
      context.runtime.requestId,
      500,
      "El tema de la tienda no está disponible.",
      "panel.settings_theme_preview_failed",
      {
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }

  return {
    siteId: context.siteId,
    store: context.store,
    themes,
    fontFaceCss: renderFontFaceCss({ basePath: FONT_BASE_PATH }),
    previewCss,
    flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const data = matches.at(-1)?.loaderData as { store?: { name?: string } } | undefined;
  return [
    { title: `Ajustes · ${data?.store?.name ?? "Panel"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "store";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
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
    redirectTo(panelHref("settings", { siteId: context.siteId, query: { ok: code } }));
  const failure = (error: unknown, message: string): PanelActionData => ({
    ok: false,
    intent,
    ...panelActionError(error, message),
  });

  if (intent === "save-store") {
    const whatsappNumber = String(form.get("whatsappNumber") ?? "").trim();
    const whatsappTemplate = String(form.get("whatsappMessageTemplate") ?? "").trim();

    const parsed = panelStoreUpdateSchema.safeParse({
      name: String(form.get("name") ?? "").trim(),
      themeId: String(form.get("themeId") ?? "").trim(),
      primaryColor: String(form.get("primaryColor") ?? "").trim(),
      colorModeDefault: String(form.get("colorModeDefault") ?? "light"),
      currency: String(form.get("currency") ?? ""),
      whatsappNumber: whatsappNumber.length > 0 ? whatsappNumber : null,
      whatsappMessageTemplate: whatsappTemplate.length > 0 ? whatsappTemplate : null,
    });

    if (!parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: "Revisa los datos de la tienda.",
          fieldErrors: fieldErrorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }

    try {
      await updatePanelStore(context.runtime.api, apiContext, parsed.data);
      return flash("store-saved");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos guardar los datos de la tienda.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "upload-logo") {
    const logo = form.get("logo");
    if (!(logo instanceof File) || logo.size === 0) {
      return data({ ok: false, intent, formError: "Elige un archivo para el logo." }, { status: 400 });
    }
    if (logo.type !== "image/webp") {
      return data(
        {
          ok: false,
          intent,
          formError: "El logo debe llegar ya convertido a WebP por el navegador.",
        },
        { status: 400 },
      );
    }
    if (logo.size > IMAGE_INPUT_MAX_BYTES) {
      return data({ ok: false, intent, formError: "El logo supera el máximo de 2 MB." }, { status: 400 });
    }

    const upload = new FormData();
    upload.set("logo", logo, "logo.webp");
    try {
      const result = await uploadStoreLogo(context.runtime.api, apiContext, upload);
      return data({
        ok: true as const,
        intent,
        message: "Logo actualizado.",
        logoUrl: result.logoUrl,
      });
    } catch (error) {
      return data(failure(error, "No pudimos guardar el logo."), { status: 400 });
    }
  }

  if (intent === "suspend") {
    if (form.get("confirm") !== "suspender") {
      return data(
        { ok: false, intent, formError: "Marca la confirmación para suspender la tienda." },
        { status: 400 },
      );
    }
    const parsed = panelSuspendStoreSchema.safeParse({
      reason: String(form.get("reason") ?? ""),
    });
    if (!parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: "Revisa el motivo.",
          fieldErrors: fieldErrorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }
    try {
      await suspendPanelStore(context.runtime.api, apiContext, parsed.data);
      return flash("store-suspended");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos suspender la tienda.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "reactivate") {
    try {
      await reactivatePanelStore(context.runtime.api, apiContext);
      return flash("store-reactivated");
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos reactivar la tienda.");
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  if (intent === "delete-store") {
    const parsed = panelDeleteStoreSchema.safeParse({
      password: String(form.get("password") ?? ""),
      confirmSlug: String(form.get("confirmSlug") ?? "").trim(),
    });
    if (!parsed.success) {
      return data(
        {
          ok: false as const,
          intent,
          formError: "Revisa la confirmación.",
          fieldErrors: fieldErrorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }
    if (form.get("confirm") !== "eliminar") {
      return data(
        { ok: false, intent, formError: "Marca la confirmación final para eliminar la tienda." },
        { status: 400 },
      );
    }

    try {
      await deletePanelStore(context.runtime.api, apiContext, parsed.data);
      // La tienda ya no existe: la página de confirmación no depende de sesión.
      return redirectTo(panelHref("eliminada", { siteId: context.siteId }));
    } catch (error) {
      const mapped = panelActionError(error, "No pudimos eliminar la tienda.");
      if (error instanceof Error && "reason" in error) {
        const reason = (error as { reason?: string }).reason;
        if (reason === "INVALID_PASSWORD") {
          mapped.fieldErrors.password = "La contraseña no es correcta.";
        }
        if (reason === "CONFIRM_SLUG_MISMATCH") {
          mapped.fieldErrors.confirmSlug = "El identificador no coincide con el de la tienda.";
        }
      }
      return data({ ok: false as const, intent, ...mapped }, { status: mapped.status });
    }
  }

  return data({ ok: false, intent, formError: "Acción no reconocida." }, { status: 400 });
}

export default function PanelSettings({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const { store } = loaderData;
  const error = actionData && "formError" in actionData ? actionData.formError : null;
  const fieldErrors = actionData && "fieldErrors" in actionData ? actionData.fieldErrors ?? {} : {};
  const suspended = store.status === "suspended";
  const suspendedByAdmin = suspended && store.suspendedBy === "admin";

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Configuración"
        title="Ajustes de la tienda"
        description={
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={store.status === "active" ? "success" : suspended ? "danger" : "warning"}
            >
              {store.status === "active" ? "Activa" : suspended ? "Suspendida" : "Pendiente"}
            </StatusBadge>
            <span className="font-mono text-xs">{store.slug}</span>
            <span>· {store.owner.email}</span>
          </p>
        }
      />

      <PanelFlash message={loaderData.flash} />
      {error ? <PanelAlert tone="danger" title="La acción no se completó">{error}</PanelAlert> : null}

      <style dangerouslySetInnerHTML={{ __html: loaderData.fontFaceCss }} />

      <PanelCard>
        <h2 className="font-heading text-base font-semibold">Datos y apariencia</h2>
        <p className="mt-1 text-sm text-text-muted">
          El panel mantiene su superficie neutral; el tema y el color se aplican al catálogo
          público.
        </p>
        <div className="mt-4">
          <SettingsForm
            store={store}
            themes={loaderData.themes}
            previewCss={loaderData.previewCss}
            actionData={actionData}
          />
        </div>
      </PanelCard>

      <PanelCard>
        <h2 className="font-heading text-base font-semibold">Logo</h2>
        <p className="mt-1 text-sm text-text-muted">
          Se muestra en la cabecera de la tienda. Se normaliza a WebP en el navegador.
        </p>
        <div className="mt-3">
          <LogoUploader currentLogoUrl={store.logoUrl} />
        </div>
      </PanelCard>

      <PanelCard className={suspendedByAdmin ? "border-danger/40" : "border-warning/40"}>
        <h2 className="font-heading text-base font-semibold">Estado de la tienda</h2>

        {suspendedByAdmin ? (
          <div className="mt-3 flex flex-col gap-2">
            <PanelAlert tone="danger" title="Suspendida por TuCatálogo">
              <p>
                El catálogo público responde 404. No puedes reactivarla desde el panel; contacta
                con el equipo de TuCatálogo.
              </p>
              {store.suspendedReason ? (
                <p className="mt-1">
                  Motivo: <strong>{store.suspendedReason}</strong>
                </p>
              ) : null}
            </PanelAlert>
          </div>
        ) : suspended ? (
          <div className="mt-3 flex flex-col gap-3">
            <PanelAlert tone="warning" title="La tienda está suspendida">
              <p>
                El catálogo público responde 404. Puedes reactivarla ahora mismo: los datos y las
                imágenes se conservan.
              </p>
            </PanelAlert>
            <Form method="post">
              <input type="hidden" name="intent" value="reactivate" />
              <Button type="submit" disabled={pending}>
                Reactivar tienda
              </Button>
            </Form>
          </div>
        ) : (
          <details className="mt-3">
            <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-warning/60 bg-surface px-4 text-sm font-medium hover:bg-surface-2 sm:h-9">
              Suspender la tienda
            </summary>
            <Form method="post" className="mt-3 flex flex-col gap-3" noValidate>
              <input type="hidden" name="intent" value="suspend" />
              <Field
                id="suspend-reason"
                label="Motivo (opcional)"
                hint="Solo lo verás tú en el panel. El storefront no revela motivos."
                error={fieldErrors.reason}
              >
                <Input
                  id="suspend-reason"
                  name="reason"
                  maxLength={300}
                  invalid={Boolean(fieldErrors.reason)}
                  aria-describedby={fieldErrors.reason ? "suspend-reason-error" : "suspend-reason-hint"}
                />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" value="suspender" required className="mt-0.5 size-4" />
                Entiendo que la tienda dejará de ser pública (404) hasta que la reactive.
              </label>
              <div>
                <Button type="submit" variant="secondary" disabled={pending}>
                  Suspender tienda
                </Button>
              </div>
            </Form>
          </details>
        )}
      </PanelCard>

      <PanelCard className="border-danger/40">
        <h2 className="font-heading text-base font-semibold text-danger">Eliminar la tienda</h2>
        <p className="mt-1 text-sm text-text-muted">
          Es irreversible: se borran productos, categorías, hero, imágenes, cuenta y sesiones. El
          identificador queda en cuarentena 90 días.
        </p>
        <details className="mt-3">
          <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-danger/50 bg-surface px-4 text-sm font-medium text-danger hover:bg-surface-2 sm:h-9">
            Quiero eliminar mi tienda
          </summary>
          <Form method="post" className="mt-3 flex flex-col gap-3" noValidate>
            <input type="hidden" name="intent" value="delete-store" />
            <Field
              id="delete-password"
              label="Tu contraseña"
              hint="Se reautentica en el servidor; no se guarda."
              error={fieldErrors.password}
              required
            >
              <Input
                id="delete-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "delete-password-error" : "delete-password-hint"}
              />
            </Field>
            <Field
              id="delete-slug"
              label={`Escribe “${store.slug}” para confirmar`}
              error={fieldErrors.confirmSlug}
              required
            >
              <Input
                id="delete-slug"
                name="confirmSlug"
                autoComplete="off"
                required
                invalid={Boolean(fieldErrors.confirmSlug)}
                aria-describedby={fieldErrors.confirmSlug ? "delete-slug-error" : undefined}
                className="font-mono"
              />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" value="eliminar" required className="mt-0.5 size-4" />
              Entiendo que esta acción es permanente y no se puede deshacer.
            </label>
            <div>
              <Button type="submit" variant="danger" disabled={pending}>
                Eliminar tienda definitivamente
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
