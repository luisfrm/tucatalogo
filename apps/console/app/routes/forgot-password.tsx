import { forgotConsolePassword } from "@tucatalogo/api-client";
import { forgotPasswordSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { data, Form, Link, useActionData, useNavigation } from "react-router";

import { Alert } from "../components/alert";
import { AuthShell } from "../components/auth-shell";
import { TextField } from "../components/field";
import { apiContext, getApi } from "../lib/api.server";
import { describeApiError, isRateLimited, toApiErrorShape } from "../lib/errors";
import { consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/forgot-password";

const GENERIC_MESSAGE =
  "Si el email pertenece a un administrador, recibirás un enlace para restablecer la contraseña. Caduca en 30 minutos.";

type ForgotActionData =
  | { ok: true; submitted: true; message: string; errors: Record<string, string> }
  | { ok: false; submitted: false; message: string; errors: Record<string, string> };

export function loader() {
  return data({}, { headers: consoleResponseHeaders() });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form));

  if (!parsed.success) {
    return data<ForgotActionData>(
      {
        ok: false,
        submitted: false,
        message: "Escribe un email válido.",
        errors: { email: parsed.error.issues[0]?.message ?? "Escribe un email válido." },
      },
      { status: 400, headers: consoleResponseHeaders() },
    );
  }

  const api = getApi();
  try {
    await forgotConsolePassword(api, parsed.data, apiContext(request));
  } catch (error) {
    // Un 429 o un fallo del servidor sí se muestran; el resto mantiene la
    // respuesta genérica para no revelar si el email existe.
    if (isRateLimited(error)) {
      return data<ForgotActionData>(
        {
          ok: false,
          submitted: false,
          message: describeApiError(error),
          errors: {},
        },
        { status: 429, headers: consoleResponseHeaders() },
      );
    }
    const shape = toApiErrorShape(error);
    if (shape && shape.status >= 500) {
      return data<ForgotActionData>(
        {
          ok: false,
          submitted: false,
          message:
            "No pudimos enviar el correo en este momento. Inténtalo de nuevo en unos minutos.",
          errors: {},
        },
        { status: 503, headers: consoleResponseHeaders() },
      );
    }
  }

  return data<ForgotActionData>(
    { ok: true, submitted: true, message: GENERIC_MESSAGE, errors: {} },
    { headers: consoleResponseHeaders() },
  );
}

export function meta() {
  return [{ title: "Recuperar contraseña · Console TuCatálogo" }];
}

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Te enviaremos un enlace de un solo uso al email del administrador."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {actionData?.submitted ? (
        <div className="grid gap-4">
          <Alert tone="success" title="Solicitud recibida">
            {actionData.message}
          </Alert>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <Form method="post" className="grid gap-4" noValidate>
          {actionData && !actionData.ok ? (
            <Alert tone="error" title="No se pudo enviar">
              {actionData.message}
            </Alert>
          ) : null}

          <TextField
            id="email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={actionData && !actionData.ok ? actionData.errors?.email : undefined}
          />

          <Button type="submit" fullWidth disabled={busy}>
            {busy ? "Enviando…" : "Enviar enlace"}
          </Button>

          <p className="text-xs text-text-muted">
            Por seguridad, la respuesta es la misma exista o no el email.
          </p>
        </Form>
      )}
    </AuthShell>
  );
}
