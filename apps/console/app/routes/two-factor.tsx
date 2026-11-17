import {
  ApiClientError,
  readConsoleSession,
  setupConsoleTwoFactor,
  verifyConsoleTwoFactor,
} from "@tucatalogo/api-client";
import { twoFactorSetupSchema, twoFactorVerifySchema } from "@tucatalogo/types";
import { Button } from "@tucatalogo/ui";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useState } from "react";

import { Alert } from "../components/alert";
import { AuthShell } from "../components/auth-shell";
import { SelectField, TextField } from "../components/field";
import { BackupCodes, CopyField } from "../components/secret-block";
import { apiContext, getApi } from "../lib/api.server";
import { describeApiError, fieldErrorsFrom, statusFromApiError } from "../lib/errors";
import { consoleResponseHeaders } from "../lib/http.server";
import type { Route } from "./+types/two-factor";

type TwoFactorActionData =
  | {
      ok: true;
      intent: "setup";
      totpUri: string;
      backupCodes: string[];
      enrollmentToken: string;
    }
  | {
      ok: false;
      intent: "setup" | "verify";
      message: string;
      fieldErrors?: Record<string, string>;
      alreadyEnabled?: boolean;
      /** Se devuelve para reintentar sin quemar el enrolamiento. */
      enrollmentToken?: string;
    };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("setup") === "1" ? "setup" : "verify";
  const api = getApi();

  try {
    const session = await readConsoleSession(api, apiContext(request));
    throw redirect("/", { headers: consoleResponseHeaders(session.setCookies) });
  } catch (error) {
    if (error instanceof ApiClientError) {
      /*
       * M1: el login normal (y `/init`) ya no crea una sesión; solo dejan el
       * challenge `console.two_factor` o un `enrollmentToken` en el formulario.
       * Por eso un 401 aquí es el estado esperado de `/2fa` y NO se redirige a
       * `/login`. Un 403 `TWO_FACTOR_REQUIRED` tampoco: la página es justamente
       * donde se completa el segundo factor.
       */
      if (
        error.status === 401 ||
        (error.status === 403 && error.reason === "TWO_FACTOR_REQUIRED")
      ) {
        return data({ mode }, { headers: consoleResponseHeaders() });
      }
      throw error;
    }
    throw error;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const api = getApi();

  if (intent === "setup") {
    const parsed = twoFactorSetupSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data<TwoFactorActionData>(
        {
          ok: false,
          intent: "setup",
          message: "Escribe tu contraseña actual.",
          fieldErrors: { password: parsed.error.issues[0]?.message ?? "Escribe tu contraseña." },
        },
        { status: 400, headers: consoleResponseHeaders() },
      );
    }

    let result;
    try {
      // M1: `/2fa/setup` no cuelga de una sesión; exige email+password y
      // devuelve un challenge de enrolamiento.
      result = await setupConsoleTwoFactor(
        api,
        { email: parsed.data.email, password: parsed.data.password },
        apiContext(request),
      );
    } catch (error) {
      const alreadyEnabled =
        error instanceof ApiClientError &&
        (error.reason === "TOTP_ALREADY_ENABLED" || error.reason === "TWO_FACTOR_ALREADY_ENABLED");
      return data<TwoFactorActionData>(
        {
          ok: false,
          intent: "setup",
          message: alreadyEnabled
            ? "El 2FA ya está activo. Introduce un código para entrar."
            : describeApiError(error, "No pudimos activar el 2FA."),
          fieldErrors: fieldErrorsFrom(error),
          alreadyEnabled,
        },
        { status: statusFromApiError(error), headers: consoleResponseHeaders() },
      );
    }

    return data<TwoFactorActionData>(
      {
        ok: true,
        intent: "setup",
        totpUri: result.totpUri,
        backupCodes: result.backupCodes,
        enrollmentToken: result.enrollmentToken,
      },
      // Sin cookies: el enrolamiento no abre sesión.
      { headers: consoleResponseHeaders() },
    );
  }

  if (intent === "verify") {
    const parsed = twoFactorVerifySchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data<TwoFactorActionData>(
        {
          ok: false,
          intent: "verify",
          message: "Revisa el código.",
          fieldErrors: { code: parsed.error.issues[0]?.message ?? "Revisa el código." },
        },
        { status: 400, headers: consoleResponseHeaders() },
      );
    }

    let result;
    try {
      result = await verifyConsoleTwoFactor(api, parsed.data, apiContext(request));
    } catch (error) {
      const invalidCode =
        error instanceof ApiClientError &&
        error.status === 401 &&
        error.reason === "TWO_FACTOR_INVALID";
      const invalidEnrollment =
        error instanceof ApiClientError && error.reason === "ENROLLMENT_TOKEN_INVALID";

      return data<TwoFactorActionData>(
        {
          ok: false,
          intent: "verify",
          message: invalidEnrollment
            ? "El proceso de alta del 2FA caducó. Vuelve a iniciar sesión para empezar de nuevo."
            : describeApiError(error, "El código no es válido."),
          fieldErrors: invalidCode
            ? { code: "El código no es válido o ya se usó." }
            : fieldErrorsFrom(error),
          // M1: un código erróneo no consume el token. Solo se descarta si el
          // propio API dice que el challenge ya no existe.
          enrollmentToken: invalidEnrollment ? undefined : parsed.data.enrollmentToken,
        },
        {
          status: invalidCode || invalidEnrollment ? 400 : statusFromApiError(error),
          headers: consoleResponseHeaders(),
        },
      );
    }

    // M1: la sesión se emite exclusivamente aquí. Si el API no entrega cookie,
    // no se simula un login correcto.
    if (result.setCookies.length === 0) {
      return data<TwoFactorActionData>(
        {
          ok: false,
          intent: "verify",
          message: "El código era correcto, pero el API no emitió la sesión. Vuelve a intentarlo.",
        },
        { status: 502, headers: consoleResponseHeaders() },
      );
    }

    return redirect("/", { headers: consoleResponseHeaders(result.setCookies) });
  }

  return data<TwoFactorActionData>(
    { ok: false, intent: "verify", message: "Acción no reconocida." },
    { status: 400, headers: consoleResponseHeaders() },
  );
}

export function meta() {
  return [{ title: "Verificación en dos pasos · Console TuCatálogo" }];
}

export default function TwoFactor() {
  const { mode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showSetup, setShowSetup] = useState(mode === "setup");
  const [codeType, setCodeType] = useState<"totp" | "backup">("totp");

  const actionSetup = actionData?.ok && actionData.intent === "setup" ? actionData : null;
  // La URI y los backup codes solo viven en memoria del componente mientras se
  // completa el enrolamiento; nunca pasan por storage.
  const [enrollment, setEnrollment] = useState<typeof actionSetup>(null);

  useEffect(() => {
    if (actionSetup) setEnrollment(actionSetup);
  }, [actionSetup]);

  const busyIntent =
    navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const setupResult = actionSetup ?? enrollment;
  const setupFailure =
    actionData && !actionData.ok && actionData.intent === "setup" ? actionData : null;
  const verifyFailure =
    actionData && !actionData.ok && actionData.intent === "verify" ? actionData : null;
  const alreadyEnabled = setupFailure?.alreadyEnabled === true;

  // Token de enrolamiento activo: el del setup o el devuelto tras un código
  // erróneo (no se consume). Si existe, el formulario es TOTP-only.
  const enrollmentToken = setupResult?.enrollmentToken ?? verifyFailure?.enrollmentToken ?? null;

  const verifyForm = (
    <Form method="post" className="grid gap-4" noValidate>
      <input type="hidden" name="intent" value="verify" />
      {enrollmentToken ? (
        <input type="hidden" name="enrollmentToken" value={enrollmentToken} />
      ) : null}

      {verifyFailure ? (
        <Alert tone="error" title="Código no válido">
          {verifyFailure.message}
        </Alert>
      ) : null}

      {enrollmentToken ? (
        <input type="hidden" name="type" value="totp" />
      ) : (
        <SelectField
          id="type"
          name="type"
          label="Tipo de código"
          defaultValue="totp"
          onChange={(event) =>
            setCodeType(event.currentTarget.value === "backup" ? "backup" : "totp")
          }
          options={[
            { value: "totp", label: "Código TOTP (6 dígitos)" },
            { value: "backup", label: "Código de respaldo" },
          ]}
        />
      )}

      <TextField
        id="code"
        name="code"
        label={enrollmentToken ? "Código TOTP" : "Código"}
        inputMode={!enrollmentToken && codeType === "backup" ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        minLength={6}
        maxLength={40}
        required
        autoFocus
        hint={
          enrollmentToken
            ? "En el enrolamiento solo se acepta el código TOTP de la app autenticadora."
            : codeType === "backup"
              ? "Cada código de respaldo sirve una sola vez."
              : "El código TOTP cambia cada 30 s."
        }
        error={verifyFailure?.fieldErrors?.code}
      />

      <Button type="submit" fullWidth disabled={busyIntent === "verify"}>
        {busyIntent === "verify" ? "Verificando…" : "Verificar y entrar"}
      </Button>
    </Form>
  );

  return (
    <AuthShell
      title="Verificación en dos pasos"
      description={
        enrollmentToken
          ? "Completa el enrolamiento con un código TOTP. La sesión se abre solo al verificar."
          : "Introduce el código de tu app autenticadora o uno de los códigos de respaldo."
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Form method="post" action="/logout">
            <Button type="submit" variant="link" size="sm">
              Empezar de nuevo
            </Button>
          </Form>
          <Link to="/login" className="text-xs text-text-muted underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </div>
      }
    >
      <div className="grid gap-5">
        {setupResult ? (
          <>
            <Alert tone="success" title="2FA configurado">
              Verifica un código de la app autenticadora para activar la sesión.
            </Alert>
            <CopyField label="URI TOTP" value={setupResult.totpUri} />
            <BackupCodes codes={setupResult.backupCodes} />
            <hr className="border-border" />
            {verifyForm}
          </>
        ) : enrollmentToken ? (
          <>
            <Alert tone="warning" title="Enrolamiento pendiente">
              Completa el enrolamiento con el token de esta pantalla. Un código erróneo no consume
              el token; solo se acepta TOTP.
            </Alert>
            {verifyForm}
          </>
        ) : alreadyEnabled ? (
          <>
            <Alert tone="info" title="2FA ya configurado">
              El secreto TOTP ya existe. Introduce un código de tu app autenticadora o un código de
              respaldo.
            </Alert>
            {verifyForm}
          </>
        ) : showSetup ? (
          <Form method="post" className="grid gap-4" noValidate>
            <input type="hidden" name="intent" value="setup" />
            <Alert tone="info" title="Enrolamiento obligatorio">
              Aún no hay un TOTP verificado. Confirma tu email y contraseña para generar el secreto
              y los códigos de respaldo. No se crea sesión.
            </Alert>

            {setupFailure ? (
              <Alert tone="error" title="No se pudo configurar el 2FA">
                {setupFailure.message}
              </Alert>
            ) : null}

            <TextField
              id="setup-email"
              name="email"
              label="Email del administrador"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              error={setupFailure?.fieldErrors?.email}
            />
            <TextField
              id="password"
              name="password"
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
              required
              error={setupFailure?.fieldErrors?.password}
            />

            <Button type="submit" fullWidth disabled={busyIntent === "setup"}>
              {busyIntent === "setup" ? "Generando…" : "Generar secreto TOTP"}
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)}>
              Ya tengo un código
            </Button>
          </Form>
        ) : (
          <>
            {verifyForm}
            <Button variant="ghost" size="sm" onClick={() => setShowSetup(true)}>
              Aún no he configurado el 2FA
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
