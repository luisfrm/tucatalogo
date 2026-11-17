import { ApiClientError, loginConsole, readConsoleSession, setupConsoleTwoFactor } from "@tucatalogo/api-client";
import { consoleLoginSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";

import { Alert } from "../components/alert";
import { AuthShell } from "../components/auth-shell";
import { TextField } from "../components/field";
import { BackupCodes, CopyField } from "../components/secret-block";
import { apiContext, getApi } from "../lib/api.server";
import { describeApiError, fieldErrorsFrom, statusFromApiError } from "../lib/errors";
import { consoleChallengeCookies, consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/login";

type LoginActionData =
  | {
      ok: true;
      mode: "enroll";
      adminEmail: string;
      totpUri: string;
      backupCodes: string[];
      enrollmentToken: string;
    }
  | {
      ok: false;
      errors: Record<string, string>;
      message: string;
    };

export async function loader({ request }: Route.LoaderArgs) {
  const api = getApi();

  try {
    const session = await readConsoleSession(api, apiContext(request));
    throw redirect("/", { headers: consoleResponseHeaders(session.setCookies) });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 403 && error.reason === "TWO_FACTOR_REQUIRED") {
        throw redirect("/2fa");
      }
      if (error.status !== 401) throw error;
      return data({}, { headers: consoleResponseHeaders() });
    }
    throw error;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = consoleLoginSchema.safeParse(Object.fromEntries(form));

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return data(
      { ok: false as const, errors, message: "Revisa el formulario." },
      { status: 400, headers: consoleResponseHeaders() },
    );
  }

  const api = getApi();
  let result;
  try {
    result = await loginConsole(api, parsed.data, apiContext(request));
  } catch (error) {
    return data<LoginActionData>(
      {
        ok: false,
        errors: fieldErrorsFrom(error),
        message: describeApiError(error, "No pudimos iniciar sesión. Inténtalo de nuevo."),
      },
      { status: statusFromApiError(error), headers: consoleResponseHeaders() },
    );
  }

  /*
   * M1: `/login` nunca emite la cookie de sesión.
   *
   * - Enrolamiento pendiente: el API devuelve un `enrollmentToken`, pero no el
   *   secreto TOTP. Se pide `/2fa/setup` con email+contraseña (sin sesión) para
   *   mostrar la URI/códigos y se renderiza el alta en esta misma página.
   * - 2FA activo: solo se reenvía el challenge `console.two_factor` y se pasa a
   *   `/2fa`. Cualquier cookie de sesión se descarta.
   */
  if (result.enrollmentRequired) {
    let setup;
    try {
      setup = await setupConsoleTwoFactor(
        api,
        { email: parsed.data.email, password: parsed.data.password },
        apiContext(request),
      );
    } catch (error) {
      return data<LoginActionData>(
        {
          ok: false,
          errors: fieldErrorsFrom(error),
          message: describeApiError(error, "No pudimos preparar el alta del segundo factor."),
        },
        { status: statusFromApiError(error), headers: consoleResponseHeaders() },
      );
    }

    return data<LoginActionData>(
      {
        ok: true,
        mode: "enroll",
        adminEmail: result.admin?.email ?? parsed.data.email,
        totpUri: setup.totpUri,
        backupCodes: setup.backupCodes,
        enrollmentToken: setup.enrollmentToken,
      },
      // Sin cookies: el enrolamiento no crea sesión.
      { headers: consoleResponseHeaders() },
    );
  }

  if (result.twoFactorRequired) {
    return redirect("/2fa", {
      headers: consoleResponseHeaders(consoleChallengeCookies(result.setCookies)),
    });
  }

  // Contrato M1: no hay sesión que asumir aquí. Si el API no pide 2FA, se
  // vuelve al login sin reenviar cookies.
  return redirect("/login", { headers: consoleResponseHeaders() });
}

export function meta() {
  return [{ title: "Iniciar sesión · Console TuCatálogo" }];
}

export default function Login() {
  const actionData = useActionData<LoginActionData>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  if (actionData?.ok && actionData.mode === "enroll") {
    return (
      <AuthShell
        title="Alta del segundo factor"
        description="Tu cuenta aún no tiene un TOTP verificado. Añade el secreto a tu app y confirma un código para abrir la sesión."
        wide
        footer={
          <p className="text-xs text-text-muted">
            La sesión no se crea hasta verificar el código. El token de enrolamiento caduca en 10
            minutos y solo sirve una vez.
          </p>
        }
      >
        <div className="grid gap-5">
          <Alert tone="info" title="Enrolamiento obligatorio">
            La cuenta <strong>{actionData.adminEmail}</strong> existe, pero todavía no tiene 2FA
            verificado.
          </Alert>

          <CopyField label="URI TOTP" value={actionData.totpUri} />
          <BackupCodes codes={actionData.backupCodes} />

          <Alert tone="warning" title="Códigos de respaldo">
            Guárdalos ahora. En el enrolamiento solo se acepta un código TOTP de la app; los
            códigos de respaldo no sirven hasta que el 2FA esté verificado.
          </Alert>

          {/*
            M1: token en un POST oculto, nunca en la query. `/2fa` lo valida y
            solo entonces emite `console.session_token`.
          */}
          <Form method="post" action="/2fa" className="grid gap-4" noValidate>
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="type" value="totp" />
            <input type="hidden" name="enrollmentToken" value={actionData.enrollmentToken} />
            <TextField
              id="enrollment-code"
              name="code"
              label="Código TOTP"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              minLength={6}
              maxLength={40}
              required
              autoFocus
              hint="El código de 6 dígitos de tu app autenticadora."
            />
            <Button type="submit" fullWidth disabled={busy}>
              {busy ? "Verificando…" : "Verificar y entrar"}
            </Button>
          </Form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Acceso al console"
      description="Backoffice de TuCatálogo. La sesión exige un código de verificación adicional."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/recuperar" className="font-medium text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link to="/init" className="text-xs text-text-muted underline underline-offset-4">
            Alta inicial
          </Link>
        </div>
      }
    >
      <Form method="post" className="grid gap-4" noValidate>
        {actionData && !actionData.ok ? (
          <Alert tone="error" title="No se pudo iniciar sesión">
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
        <TextField
          id="password"
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          error={actionData && !actionData.ok ? actionData.errors?.password : undefined}
        />

        <Button type="submit" fullWidth disabled={busy}>
          {busy ? "Entrando…" : "Continuar"}
        </Button>
      </Form>
    </AuthShell>
  );
}
