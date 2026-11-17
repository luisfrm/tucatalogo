import { ApiClientError, getConsoleInitStatus, initConsole } from "@tucatalogo/api-client";
import { consoleInitSchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";

import { Alert } from "../components/alert";
import { AuthShell } from "../components/auth-shell";
import { TextField } from "../components/field";
import { BackupCodes, CopyField } from "../components/secret-block";
import { apiContext, getApi } from "../lib/api.server";
import { describeApiError } from "../lib/errors";
import { validatePasswordPair } from "../lib/validation.server";
import { consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/init";

type InitActionData =
  | {
      ok: true;
      adminEmail: string;
      totpUri: string;
      backupCodes: string[];
      enrollmentToken: string;
    }
  | {
      ok: false;
      consumed?: true;
      errors: Record<string, string>;
      message: string;
    };

export async function loader() {
  const api = getApi();
  const status = await getConsoleInitStatus(api);
  return data({ available: status.available }, { headers: consoleResponseHeaders() });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = consoleInitSchema.safeParse(Object.fromEntries(form));

  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
  }

  const password = validatePasswordPair(form.get("password"), form.get("confirmPassword"));
  if (!password.ok) {
    errors.confirmPassword = password.message;
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return data<InitActionData>(
      { ok: false, errors, message: "Revisa los datos del formulario." },
      { status: 400, headers: consoleResponseHeaders() },
    );
  }

  const api = getApi();
  let result;
  try {
    result = await initConsole(api, parsed.data, apiContext(request));
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 410 || error.reason === "INIT_CONSUMED") {
        return data<InitActionData>(
          {
            ok: false,
            consumed: true,
            errors: {},
            message: "El alta inicial ya se completó. Inicia sesión con el admin existente.",
          },
          { status: 410, headers: consoleResponseHeaders() },
        );
      }
      if (error.status === 401) {
        return data<InitActionData>(
          {
            ok: false,
            errors: { initToken: "El token de alta no es correcto." },
            message: "El token de alta no es correcto.",
          },
          { status: 400, headers: consoleResponseHeaders() },
        );
      }
      return data<InitActionData>(
        {
          ok: false,
          errors: {},
          message: describeApiError(error, "No pudimos crear el administrador."),
        },
        { status: error.status >= 500 ? 500 : 400, headers: consoleResponseHeaders() },
      );
    }
    throw error;
  }

  return data<InitActionData>(
    {
      ok: true,
      adminEmail: result.admin.email,
      totpUri: result.totpUri,
      backupCodes: result.backupCodes,
      enrollmentToken: result.enrollmentToken,
    },
    // M1: `/init` no emite cookies. Aunque el API devolviera alguna, no se
    // reenvía al navegador: la sesión solo nace en `/2fa/verify`.
    { headers: consoleResponseHeaders() },
  );
}

export function meta() {
  return [{ title: "Alta inicial · Console TuCatálogo" }];
}

export default function InitConsole() {
  const { available } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  if (actionData?.ok) {
    return (
      <AuthShell
        title="Administrador creado"
        description="Guarda estos datos ahora. El secreto TOTP y los códigos de respaldo se muestran una sola vez."
        wide
        footer={
          <p className="text-xs text-text-muted">
            La cuenta existe, pero la sesión no se abre hasta verificar el código TOTP.
          </p>
        }
      >
        <div className="grid gap-5">
          <Alert tone="success" title="Falta verificar el segundo factor">
            La cuenta <strong>{actionData.adminEmail}</strong> ya existe. Añade la URI a tu app
            autenticadora y verifica un código para activar el acceso.
          </Alert>

          <CopyField label="URI TOTP" value={actionData.totpUri} />
          <BackupCodes codes={actionData.backupCodes} />

          <Alert tone="warning" title="Antes de continuar">
            Si sales de esta página sin guardar los códigos de respaldo, no podrás recuperarlos.
            El token de enrolamiento caduca en 10 minutos y solo sirve una vez.
          </Alert>

          {/*
            M1: el token viaja en un formulario POST oculto, nunca en la query ni
            en storage. `/2fa` lo cambia por la cookie de sesión.
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
            <Button type="submit" fullWidth>
              Verificar y entrar
            </Button>
          </Form>
        </div>
      </AuthShell>
    );
  }

  if (!available || (actionData && !actionData.ok && "consumed" in actionData && actionData.consumed)) {
    return (
      <AuthShell
        title="Alta inicial cerrada"
        description="Este formulario deja de existir en cuanto hay un administrador."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Ir a iniciar sesión
          </Link>
        }
      >
        <Alert tone="info" title="410 · Gone">
          El alta inicial ya se completó. No hay ninguna interfaz para crear más administradores
          en el MVP.
        </Alert>
      </AuthShell>
    );
  }

  const fieldError = (key: string) =>
    actionData && !actionData.ok ? actionData.errors?.[key] : undefined;

  return (
    <AuthShell
      title="Alta inicial del console"
      description="Crea el único administrador del backoffice. El token de alta se reenvía al API y no se almacena."
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Ya tengo cuenta
          </Link>
          <span className="text-xs">El formulario se cierra tras el primer admin.</span>
        </div>
      }
    >
      <Form method="post" className="grid gap-4" noValidate>
        {actionData && !actionData.ok ? (
          <Alert tone="error" title="No se pudo completar el alta">
            {actionData.message}
            {actionData.errors && Object.keys(actionData.errors).length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs">
                {Object.entries(actionData.errors).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        <TextField
          id="initToken"
          name="initToken"
          label="Token de alta (INIT_TOKEN)"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          hint="Lo entrega el operador del despliegue. No se guarda en el navegador."
          error={fieldError("initToken")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="name"
            name="name"
            label="Nombre"
            autoComplete="name"
            required
            error={fieldError("name")}
          />
          <TextField
            id="email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={fieldError("email")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="password"
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            required
            hint="8–128 caracteres."
            error={fieldError("password")}
          />
          <TextField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            required
            error={fieldError("confirmPassword")}
          />
        </div>

        <Button type="submit" fullWidth disabled={busy}>
          {busy ? "Creando administrador…" : "Crear administrador y activar 2FA"}
        </Button>
      </Form>
    </AuthShell>
  );
}
