import { resetStorePassword } from "@tucatalogo/api-client";
import { resetPasswordSchema } from "@tucatalogo/types";
import { Button, Input } from "@tucatalogo/ui";
import { Form, Link, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/reset-password";

import { Field, FormError, PanelAlert, PanelCard } from "~/components/panel/panel-ui";
import { panelActionError, redirectTo } from "~/lib/panel.server";
import { readResetToken } from "~/lib/panel";
import { resolveStoreQuery } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

/**
 * Aterrizaje del enlace de reset (`/panel-admin/reset-password?token=…`).
 * El token nunca se guarda en cookie, storage ni logs: viaja del query al
 * campo oculto del formulario y se consume una sola vez en el API.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId } = resolveStoreQuery(request);
  const token = readResetToken(new URL(request.url));
  return { slug, siteId, token, hasToken: token !== null };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Nueva contraseña · ${loaderData?.slug ?? "Panel"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const { runtime, slug, siteId } = resolveStoreQuery(request);
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("passwordConfirmation") ?? "");

  const parsed = resetPasswordSchema.safeParse({ token, password });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "password";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return data(
      { ok: false as const, intent: "reset", formError: "Revisa los datos.", fieldErrors, values: {} },
      { status: 400 },
    );
  }

  if (password !== confirmation) {
    return data(
      {
        ok: false as const,
        intent: "reset",
        formError: "Las contraseñas no coinciden.",
        fieldErrors: { passwordConfirmation: "Repite la misma contraseña." },
        values: {},
      },
      { status: 400 },
    );
  }

  try {
    await resetStorePassword(runtime.api, parsed.data, {
      storeSlug: slug,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });
  } catch (error) {
    const mapped = panelActionError(error, "No pudimos cambiar la contraseña. Inténtalo de nuevo.");
    return data(
      {
        ok: false as const,
        intent: "reset",
        formError:
          mapped.status === 400
            ? "El enlace no es válido o caducó. Pide uno nuevo."
            : mapped.formError,
        fieldErrors: mapped.fieldErrors,
        values: {},
      },
      { status: mapped.status },
    );
  }

  return redirectTo(panelHref("login", { siteId, query: { ok: "password-reset" } }));
}

export default function PanelResetPassword({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const fieldErrors: Record<string, string> =
    actionData?.ok === false ? actionData.fieldErrors ?? {} : {};

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          panel-admin · {loaderData.slug}
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-text-muted">
          Elige una contraseña de al menos 8 caracteres para tu cuenta.
        </p>
      </div>

      <PanelCard>
        {!loaderData.hasToken ? (
          <div className="flex flex-col gap-3">
            <PanelAlert tone="danger" title="Falta el enlace">
              <p>
                Este enlace no trae un token válido. Solicita uno nuevo desde “Olvidé mi
                contraseña”.
              </p>
            </PanelAlert>
            <Button asChild variant="secondary" fullWidth>
              <Link to={panelHref("recuperar", { siteId: loaderData.siteId })}>
                Pedir otro enlace
              </Link>
            </Button>
          </div>
        ) : (
          <Form method="post" className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="token" value={loaderData.token ?? ""} />

            {actionData?.ok === false && actionData.formError ? (
              <FormError message={actionData.formError} />
            ) : null}

            <Field
              id="reset-password"
              label="Contraseña"
              hint="Mínimo 8 caracteres."
              error={fieldErrors.password}
              required
            >
              <Input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "reset-password-error" : "reset-password-hint"}
              />
            </Field>

            <Field
              id="reset-password-confirmation"
              label="Repite la contraseña"
              error={fieldErrors.passwordConfirmation}
              required
            >
              <Input
                id="reset-password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                invalid={Boolean(fieldErrors.passwordConfirmation)}
                aria-describedby={
                  fieldErrors.passwordConfirmation
                    ? "reset-password-confirmation-error"
                    : undefined
                }
              />
            </Field>

            <Button type="submit" fullWidth disabled={pending}>
              {pending ? "Guardando…" : "Cambiar contraseña"}
            </Button>

            <Link
              to={panelHref("recuperar", { siteId: loaderData.siteId })}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Pedir un enlace nuevo
            </Link>
          </Form>
        )}
      </PanelCard>
    </main>
  );
}
