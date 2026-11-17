import { loginStore } from "@tucatalogo/api-client";
import { storeLoginSchema } from "@tucatalogo/types";
import { Button, Input } from "@tucatalogo/ui";
import { Form, Link, data, useActionData, useNavigation, useSearchParams } from "react-router";

import type { Route } from "./+types/login";

import { Field, PanelAlert, PanelCard } from "~/components/panel/panel-ui";
import { panelFlashMessage } from "~/lib/panel";
import {
  actionErrorResponse,
  hasPanelSession,
  panelActionError,
  panelLoginTarget,
  redirectWithCookies,
} from "~/lib/panel.server";
import { resolveStoreQuery } from "~/lib/runtime.server";
import { panelHref } from "~/lib/urls";

export async function loader({ request }: Route.LoaderArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const url = new URL(request.url);

  if (await hasPanelSession(request)) {
    return redirectWithCookies(
      panelLoginTarget(url.searchParams.get("redirectTo"), siteId),
    );
  }

  return {
    slug,
    siteId,
    secure: runtime.secure,
    flash: panelFlashMessage(url.searchParams.get("ok")),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Iniciar sesión · ${loaderData?.slug ?? "Panel"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const { slug, siteId, runtime } = resolveStoreQuery(request);
  const form = await request.formData();
  const raw = {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  };

  const parsed = storeLoginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "email";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return data(
      {
        ok: false as const,
        intent: "login",
        formError: "Revisa los datos.",
        fieldErrors,
        values: { email: raw.email },
      },
      { status: 400 },
    );
  }

  try {
    const result = await loginStore(runtime.api, parsed.data, {
      storeSlug: slug,
      cookie: request.headers.get("cookie") ?? undefined,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });

    const target = panelLoginTarget(
      new URL(request.url).searchParams.get("redirectTo"),
      siteId,
    );
    return redirectWithCookies(target, result.setCookies);
  } catch (error) {
    const mapped = panelActionError(error, "No pudimos iniciar sesión. Inténtalo de nuevo.");
    return actionErrorResponse(
      {
        ...mapped,
        formError:
          mapped.status === 403
            ? "Ese email no es el dueño de esta tienda."
            : mapped.status === 401
              ? "Email o contraseña incorrectos."
              : mapped.formError,
      },
      { email: raw.email },
    );
  }
}

interface LoginActionData {
  ok?: boolean;
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: { email?: string };
}

export default function PanelLogin({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<LoginActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const pending = navigation.state === "submitting";
  const fieldErrors = actionData?.ok === false ? actionData.fieldErrors ?? {} : {};

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          panel-admin · {loaderData.slug}
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Entra a tu tienda</h1>
        <p className="mt-1 text-sm text-text-muted">
          Gestiona productos, categorías, hero y ajustes desde aquí.
        </p>
      </div>

      {loaderData.flash ? <PanelAlert tone="success" title={loaderData.flash} /> : null}

      <PanelCard>
        <Form method="post" className="flex flex-col gap-4" noValidate>
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? ""}
          />

          {actionData?.ok === false && actionData.formError ? (
            <PanelAlert tone="danger" title="No pudimos entrar">
              <p>{actionData.formError}</p>
            </PanelAlert>
          ) : null}

          <Field
            id="login-email"
            label="Correo"
            error={fieldErrors.email}
            required
          >
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              defaultValue={actionData?.ok === false ? actionData.values?.email ?? "" : ""}
            />
          </Field>

          <Field
            id="login-password"
            label="Contraseña"
            error={fieldErrors.password}
            required
          >
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            />
          </Field>

          <Button type="submit" fullWidth disabled={pending}>
            {pending ? "Entrando…" : "Iniciar sesión"}
          </Button>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <Link
              to={panelHref("recuperar", { siteId: loaderData.siteId })}
              className="font-medium text-primary underline underline-offset-4"
            >
              Olvidé mi contraseña
            </Link>
            <Link
              to={panelHref("", { siteId: loaderData.siteId })}
              className="text-text-muted underline underline-offset-4"
            >
              Volver al panel
            </Link>
          </div>
        </Form>
      </PanelCard>

      <p className="text-center text-xs text-text-muted">
        La sesión de esta tienda no comparte cookies con el backoffice de TuCatálogo.
      </p>
    </main>
  );
}
