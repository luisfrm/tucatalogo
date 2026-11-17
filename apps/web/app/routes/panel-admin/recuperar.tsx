import { forgotStorePassword } from "@tucatalogo/api-client";
import { forgotPasswordSchema } from "@tucatalogo/types";
import { Button, Input } from "@tucatalogo/ui";
import { Form, Link, data, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/recuperar";

import { Field, FormError, PanelAlert, PanelCard } from "~/components/panel/panel-ui";
import { resolveStoreQuery } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

const GENERIC_MESSAGE =
  "Si ese correo tiene una cuenta en esta tienda, recibirás un enlace para restablecer la contraseña. El enlace caduca en 30 minutos.";

export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId } = resolveStoreQuery(request);
  return { slug, siteId };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Recuperar contraseña · ${loaderData?.slug ?? "Panel"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const { runtime, slug } = resolveStoreQuery(request);
  const form = await request.formData();
  const rawEmail = String(form.get("email") ?? "");

  const parsed = forgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return data(
      {
        ok: false as const,
        intent: "forgot",
        formError: undefined,
        fieldErrors: { email: parsed.error.issues[0]?.message ?? "Introduce un email válido." },
        values: { email: rawEmail },
      },
      { status: 400 },
    );
  }

  try {
    await forgotStorePassword(runtime.api, parsed.data, {
      storeSlug: slug,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });
  } catch (error) {
    // Enumeración: un 429/400 no revela si el email existe. Un 5xx sí es visible.
    const status = (error as { status?: number }).status ?? 500;
    if (status >= 500) {
      return data(
        {
          ok: false as const,
          intent: "forgot",
          formError: "No pudimos enviar el correo ahora mismo. Inténtalo más tarde.",
          fieldErrors: {},
          values: { email: rawEmail },
        },
        { status: 503 },
      );
    }
  }

  return data({
    ok: true as const,
    intent: "forgot",
    message: GENERIC_MESSAGE,
    fieldErrors: {},
    values: { email: rawEmail },
  });
}

interface ForgotActionData {
  ok?: boolean;
  message?: string;
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: { email?: string };
}

export default function PanelForgotPassword({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<ForgotActionData>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const fieldErrors = actionData?.ok === false ? actionData.fieldErrors ?? {} : {};
  const sent = actionData?.ok === true;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          panel-admin · {loaderData.slug}
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-text-muted">
          Te enviaremos un enlace de un solo uso al correo del dueño de la tienda.
        </p>
      </div>

      <PanelCard>
        {sent ? (
          <div className="flex flex-col gap-3">
            <PanelAlert tone="success" title="Revisa tu correo">
              <p>{actionData.message}</p>
            </PanelAlert>
            <Button asChild variant="secondary" fullWidth>
              <Link to={panelHref("login", { siteId: loaderData.siteId })}>
                Volver a iniciar sesión
              </Link>
            </Button>
          </div>
        ) : (
          <Form method="post" className="flex flex-col gap-4" noValidate>
            {actionData?.ok === false && actionData.formError ? (
              <FormError message={actionData.formError} />
            ) : null}

            <Field id="forgot-email" label="Correo del dueño" error={fieldErrors.email} required>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "forgot-email-error" : undefined}
                defaultValue={actionData?.ok === false ? actionData.values?.email ?? "" : ""}
              />
            </Field>

            <Button type="submit" fullWidth disabled={pending}>
              {pending ? "Enviando…" : "Enviar enlace"}
            </Button>

            <p className="text-xs text-text-muted">
              Por seguridad, la respuesta es la misma exista o no el correo.
            </p>

            <Link
              to={panelHref("login", { siteId: loaderData.siteId })}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Volver a iniciar sesión
            </Link>
          </Form>
        )}
      </PanelCard>
    </main>
  );
}
