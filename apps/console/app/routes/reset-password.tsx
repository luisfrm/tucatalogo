import { resetConsolePassword } from "@tucatalogo/api-client";
import { resetPasswordSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";

import { Alert } from "../components/alert";
import { AuthShell } from "../components/auth-shell";
import { TextField } from "../components/field";
import { apiContext, getApi } from "../lib/api.server";
import { describeApiError, statusFromApiError, toApiErrorShape } from "../lib/errors";
import { validatePasswordPair } from "../lib/validation.server";
import { consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/reset-password";

type ResetActionData =
  | { ok: true; tokenInvalid: false; message: string; errors: Record<string, string> }
  | { ok: false; tokenInvalid: boolean; message: string; errors: Record<string, string> };

export function loader({ request }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  return data({ token }, { headers: consoleResponseHeaders() });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = typeof form.get("token") === "string" ? String(form.get("token")).trim() : "";
  const errors: Record<string, string> = {};

  const parsed = resetPasswordSchema.safeParse({
    token,
    password: form.get("password"),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
  }

  const pair = validatePasswordPair(form.get("password"), form.get("confirmPassword"));
  if (!pair.ok) {
    errors.confirmPassword = pair.message;
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return data<ResetActionData>(
      {
        ok: false,
        tokenInvalid: !token,
        message: !token
          ? "El enlace no incluye un token. Pide uno nuevo."
          : "Revisa la contraseña.",
        errors,
      },
      { status: 400, headers: consoleResponseHeaders() },
    );
  }

  const api = getApi();
  try {
    await resetConsolePassword(api, parsed.data, apiContext(request));
  } catch (error) {
    const shape = toApiErrorShape(error);
    const tokenInvalid = shape?.reason === "RESET_TOKEN_INVALID";
    return data<ResetActionData>(
      {
        ok: false,
        tokenInvalid,
        message: describeApiError(
          error,
          "No pudimos cambiar la contraseña. Inténtalo de nuevo.",
        ),
        errors: {},
      },
      {
        status: tokenInvalid ? 400 : statusFromApiError(error),
        headers: consoleResponseHeaders(),
      },
    );
  }

  return data<ResetActionData>(
    {
      ok: true,
      tokenInvalid: false,
      message:
        "Contraseña actualizada. Para entrar tendrás que iniciar sesión y verificar el segundo factor.",
      errors: {},
    },
    { headers: consoleResponseHeaders() },
  );
}

export function meta() {
  return [{ title: "Restablecer contraseña · Console TuCatálogo" }];
}

export default function ResetPassword() {
  const { token } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  if (actionData?.ok) {
    return (
      <AuthShell
        title="Contraseña actualizada"
        description="El 2FA sigue siendo obligatorio en el siguiente inicio de sesión."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Iniciar sesión
          </Link>
        }
      >
        <div className="grid gap-4">
          <Alert tone="success" title="Listo">{actionData.message}</Alert>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  const linkInvalid =
    !token || Boolean(actionData && !actionData.ok && actionData.tokenInvalid);

  return (
    <AuthShell
      title="Restablecer contraseña"
      description="Elige una contraseña nueva para el administrador del console."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {linkInvalid ? (
        <div className="grid gap-4">
          <Alert tone="error" title="Enlace no válido">
            El enlace no es válido o ya caducó. Los enlaces duran 30 minutos y se invalidan al
            usarse.
          </Alert>
          <Link to="/recuperar" className="text-sm font-medium text-primary hover:underline">
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : (
        <Form method="post" className="grid gap-4" noValidate>
          <input type="hidden" name="token" value={token} />

          {actionData && !actionData.ok ? (
            <Alert tone="error" title="No se pudo cambiar la contraseña">
              {actionData.message}
            </Alert>
          ) : null}

          <TextField
            id="password"
            name="password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            hint="8–128 caracteres."
            error={actionData && !actionData.ok ? actionData.errors?.password : undefined}
          />
          <TextField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            required
            error={
              actionData && !actionData.ok ? actionData.errors?.confirmPassword : undefined
            }
          />

          <Button type="submit" fullWidth disabled={busy}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </Form>
      )}
    </AuthShell>
  );
}
