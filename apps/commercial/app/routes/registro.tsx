import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data, useFetcher, useRouteLoaderData, useSearchParams } from "react-router";

import {
  type SignupResponse,
  slugCheckResponseSchema,
  signupOtpSchema,
  signupSchema,
  storeSlugSchema,
} from "@tucatalogo/types";

import type { Route } from "./+types/registro";
import type { loader as rootLoader } from "~/root";

import { Button } from "@tucatalogo/ui";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getApi } from "~/lib/api";
import { getEnv, requireTurnstileSiteKey } from "~/lib/env";
import { commercialMeta } from "~/lib/social";
import { DoneStep } from "~/features/signup/done-step";
import { OtpStep } from "~/features/signup/otp-step";
import { OwnerStep } from "~/features/signup/owner-step";
import {
  describeApiError,
  isApiErrorLike,
  slugReasonMessage,
} from "~/features/signup/messages";
import { Stepper } from "~/features/signup/stepper";
import { ThemePicker } from "~/features/signup/theme-picker";
import { toSlugDraft } from "~/features/signup/slug";
import {
  EMPTY_OWNER_DRAFT,
  type FieldErrors,
  type OtpPhase,
  type OwnerDraft,
  type SignupActionData,
  type SignupActionFailure,
  type SignupStep,
  type SlugStatus,
} from "~/features/signup/types";
import {
  firstErrorField,
  hasErrors,
  OTP_FIELD_ORDER,
  OWNER_FIELD_ORDER,
  THEME_FIELD_ORDER,
  validateOtpCode,
  validateOtpRequest,
  validateOwnerDraft,
  validateThemeStep,
} from "~/features/signup/validation";

const TITLE = "Crear mi catálogo · TuCatálogo";
const DESCRIPTION =
  "Crea la tienda de tu negocio en cuatro pasos: datos, tema, verificación por correo y publicación.";

export function meta(_: Route.MetaArgs) {
  return commercialMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: "/registro",
    robots: "noindex",
  });
}

export function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return {
    turnstileSiteKey: requireTurnstileSiteKey(env),
    storeDomain: env.APP_DOMAIN,
  };
}

/**
 * Los `path` de Zod llegan con el nombre del contrato (`themeId`); el
 * formulario usa los `id` de sus campos (`theme`).
 */
const FIELD_ALIASES: Record<string, string> = { themeId: "theme" };

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = String(issue.path[0] ?? "");
    if (!path) continue;
    const field = FIELD_ALIASES[path] ?? path;
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function apiFailure(intent: "otp" | "signup", error: unknown) {
  if (isApiErrorLike(error)) {
    const described = describeApiError(error);
    const failure: SignupActionFailure = {
      ok: false,
      intent,
      message: described.message,
      errors: described.errors,
      ...(described.reason ? { reason: described.reason } : {}),
      ...(described.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: described.retryAfterSeconds }
        : {}),
    };
    const status = error.status >= 400 && error.status <= 599 ? error.status : 400;
    return data<SignupActionData>(failure, { status });
  }

  console.error(
    JSON.stringify({
      level: "error",
      app: "commercial",
      message: "Fallo inesperado en el registro",
      intent,
      detail: error instanceof Error ? error.message : String(error),
    }),
  );

  return data<SignupActionData>(
    {
      ok: false,
      intent,
      message: "No pudimos completar la solicitud. Inténtalo de nuevo.",
      errors: {},
    },
    { status: 500 },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const clientIp = request.headers.get("cf-connecting-ip") ?? undefined;

  if (intent === "otp") {
    const parsed = signupOtpSchema.safeParse({
      email: formData.get("email"),
      slug: formData.get("slug"),
      turnstileToken: formData.get("turnstileToken"),
    });

    if (!parsed.success) {
      return data<SignupActionData>(
        {
          ok: false,
          intent: "otp",
          message: "Revisa los datos del formulario antes de pedir el código.",
          errors: fieldErrorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }

    try {
      // Import dinámico: el paquete del API no entra en el bundle del navegador.
      const { signupStoreOtp } = await import("@tucatalogo/api-client");
      const api = getApi(context);
      const result = await signupStoreOtp(api, parsed.data, { clientIp });
      return data<SignupActionData>({
        ok: true,
        intent: "otp",
        resendAfterSeconds: result.resendAfterSeconds,
        expiresInMinutes: result.expiresInMinutes,
      });
    } catch (error) {
      return apiFailure("otp", error);
    }
  }

  if (intent === "signup") {
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      storeName: formData.get("storeName"),
      slug: formData.get("slug"),
      currency: formData.get("currency"),
      themeId: formData.get("themeId"),
      primaryColor: formData.get("primaryColor") || undefined,
      code: formData.get("code"),
    });

    if (!parsed.success) {
      return data<SignupActionData>(
        {
          ok: false,
          intent: "signup",
          message: "Revisa los datos del formulario.",
          errors: fieldErrorsFromZod(parsed.error),
        },
        { status: 400 },
      );
    }

    try {
      const { signupStore } = await import("@tucatalogo/api-client");
      const api = getApi(context);
      const result = await signupStore(api, parsed.data, { clientIp });
      return data<SignupActionData>({ ok: true, intent: "signup", result });
    } catch (error) {
      return apiFailure("signup", error);
    }
  }

  throw new Response("Solicitud no válida.", {
    status: 400,
    statusText: "BAD_REQUEST",
  });
}

const SLUG_DEBOUNCE_MS = 300;
const OTP_DEFAULT_EXPIRY_MINUTES = 10;
const SIGNUP_DRAFT_STORAGE_KEY = "tucatalogo_signup_draft_v1";

export default function Registro({ loaderData }: Route.ComponentProps) {
  const { turnstileSiteKey, storeDomain } = loaderData;
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const [searchParams] = useSearchParams();

  const themeMetadata = root?.themeMetadata ?? [];
  const themeIds = useMemo(
    () => themeMetadata.map((theme) => theme.id),
    [themeMetadata],
  );

  const requestedTheme = searchParams.get("tema");
  const initialThemeId =
    requestedTheme && themeIds.includes(requestedTheme as (typeof themeIds)[number])
      ? requestedTheme
      : null;

  const slugFetcher = useFetcher<unknown>();
  const otpFetcher = useFetcher<SignupActionData>();
  const signupFetcher = useFetcher<SignupActionData>();

  const [step, setStep] = useState<SignupStep>(1);
  const [draft, setDraft] = useState<OwnerDraft>(() => ({ ...EMPTY_OWNER_DRAFT }));
  const [themeId, setThemeId] = useState<string | null>(initialThemeId);
  const [primaryColor, setPrimaryColor] = useState<string>(
    () =>
      themeMetadata.find((t) => t.id === initialThemeId)?.defaultPrimaryColor ??
      themeMetadata[0]?.defaultPrimaryColor ??
      "#C09299",
  );
  const [colorCustomized, setColorCustomized] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(
    null,
  );
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: "idle" });

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [phase, setPhase] = useState<OtpPhase>("idle");
  const [code, setCode] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState(OTP_DEFAULT_EXPIRY_MINUTES);
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const [result, setResult] = useState<SignupResponse | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const handledOtp = useRef<SignupActionData | null>(null);
  const handledSignup = useRef<SignupActionData | null>(null);

  const busy = otpFetcher.state !== "idle" || signupFetcher.state !== "idle";
  const secondsLeft =
    resendDeadline === null
      ? 0
      : Math.max(0, Math.ceil((resendDeadline - clock) / 1000));

  // Foco gestionado entre pasos: el título es el primer elemento del paso.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Foco en el primer campo con error (o en el paso anterior al volver).
  useEffect(() => {
    if (!focusTarget) return;
    const element = document.getElementById(`signup-${focusTarget}`);
    if (element) element.focus();
    setFocusTarget(null);
  }, [focusTarget, step]);

  // Cuenta atrás del reenvío del OTP.
  useEffect(() => {
    if (resendDeadline === null) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendDeadline]);

  const updateDraft = useCallback((patch: Partial<OwnerDraft>) => {
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      if (patch.slug !== undefined) next.slug = toSlugDraft(patch.slug);
      return next;
    });
  }, []);

  // Restore non-sensitive draft from sessionStorage (never password).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        name: string;
        email: string;
        storeName: string;
        slug: string;
        currency: OwnerDraft["currency"];
        themeId: string;
        primaryColor: string;
      }>;
      setDraft((prev) => ({
        ...prev,
        name: saved.name ?? prev.name,
        email: saved.email ?? prev.email,
        storeName: saved.storeName ?? prev.storeName,
        slug: saved.slug ?? prev.slug,
        currency: saved.currency ?? prev.currency,
      }));
      if (!initialThemeId && saved.themeId && themeIds.includes(saved.themeId as (typeof themeIds)[number])) {
        setThemeId(saved.themeId);
      }
      if (saved.primaryColor && /^#[0-9a-fA-F]{6}$/.test(saved.primaryColor)) {
        setPrimaryColor(saved.primaryColor);
        setColorCustomized(true);
      }
    } catch {
      // Ignore invalid sessionStorage data.
    }
  }, [initialThemeId, themeIds]);

  // Persist non-sensitive draft while editing.
  useEffect(() => {
    if (step === 4) {
      try {
        sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
      } catch {
        // Ignore storage errors.
      }
      return;
    }
    try {
      sessionStorage.setItem(
        SIGNUP_DRAFT_STORAGE_KEY,
        JSON.stringify({
          name: draft.name,
          email: draft.email,
          storeName: draft.storeName,
          slug: draft.slug,
          currency: draft.currency,
          themeId,
          primaryColor,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [draft.name, draft.email, draft.storeName, draft.slug, draft.currency, themeId, primaryColor, step]);

  // Comprobación en vivo del slug (debounce 300 ms contra el resource route).
  useEffect(() => {
    const slug = draft.slug;
    if (slug.length === 0) {
      setSlugStatus({ kind: "idle" });
      return;
    }
    if (!storeSlugSchema.safeParse(slug).success) {
      setSlugStatus({ kind: "idle" });
      return;
    }

    setSlugStatus({ kind: "checking" });
    const timer = setTimeout(() => {
      slugFetcher.load(`/registro/slug-check?slug=${encodeURIComponent(slug)}`);
    }, SLUG_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `slugFetcher` es estable entre renders; solo importa el slug.
  }, [draft.slug]);

  // Respuesta de la comprobación: se ignora si llega de un slug anterior.
  useEffect(() => {
    if (slugFetcher.state !== "idle" || !slugFetcher.data) return;

    const parsed = slugCheckResponseSchema.safeParse(slugFetcher.data);
    if (!parsed.success) {
      setSlugStatus({
        kind: "unavailable",
        slug: draft.slug,
        message: "No pudimos comprobar el identificador. Inténtalo de nuevo.",
      });
      return;
    }

    const { slug, available, reason, links } = parsed.data;
    if (available && links) {
      setSlugStatus({
        kind: "available",
        slug,
        storefront: links.storefront,
        panel: links.panel,
      });
    } else {
      setSlugStatus({
        kind: "unavailable",
        slug,
        message: reason
          ? slugReasonMessage(reason)
          : "Ese identificador no está disponible.",
      });
    }
  }, [slugFetcher.state, slugFetcher.data, draft.slug]);

  // Resultado de la petición de OTP.
  useEffect(() => {
    const payload = otpFetcher.data;
    if (!payload || otpFetcher.state !== "idle" || handledOtp.current === payload) return;
    handledOtp.current = payload;
    if (payload.intent !== "otp") return;

    if (payload.ok) {
      setPhase("sent");
      setExpiresInMinutes(payload.expiresInMinutes);
      setResendDeadline(Date.now() + payload.resendAfterSeconds * 1000);
      setClock(Date.now());
      setErrors({});
      setNotice({
        tone: "info",
        text: `Te enviamos un código de 6 dígitos a ${draft.email}.`,
      });
      // El token de Turnstile se consume con la petición: se pide uno nuevo.
      setTurnstileToken(null);
      setResetSignal((value) => value + 1);
      setFocusTarget("code");
      return;
    }

    setPhase("idle");
    setErrors(payload.errors);
    setNotice({ tone: "error", text: payload.message });

    if (payload.retryAfterSeconds !== undefined) {
      setResendDeadline(Date.now() + payload.retryAfterSeconds * 1000);
      setClock(Date.now());
    }

    if (payload.reason === "TURNSTILE_FAILED") {
      setTurnstileToken(null);
      setResetSignal((value) => value + 1);
    }

    if (
      payload.reason === "SLUG_TAKEN" ||
      payload.reason === "SLUG_RESERVED" ||
      payload.reason === "SLUG_QUARANTINED" ||
      payload.reason === "EMAIL_TAKEN"
    ) {
      setStep(1);
      setSlugStatus({ kind: "idle" });
      setFocusTarget(payload.errors.slug ? "slug" : "email");
      return;
    }

    const first = firstErrorField(payload.errors, OTP_FIELD_ORDER);
    if (first && first !== "turnstileToken") setFocusTarget(first);
  }, [otpFetcher.data, otpFetcher.state, draft.email]);

  // Resultado del POST final (creación de la tienda).
  useEffect(() => {
    const payload = signupFetcher.data;
    if (!payload || signupFetcher.state !== "idle" || handledSignup.current === payload) {
      return;
    }
    handledSignup.current = payload;
    if (payload.intent !== "signup") return;

    if (payload.ok) {
      setResult(payload.result);
      setErrors({});
      setNotice(null);
      setPhase("idle");
      setStep(4);
      return;
    }

    if (
      payload.reason === "SLUG_TAKEN" ||
      payload.reason === "SLUG_QUARANTINED" ||
      payload.reason === "SLUG_FORMAT" ||
      payload.reason === "SLUG_RESERVED" ||
      payload.reason === "EMAIL_TAKEN"
    ) {
      setErrors(payload.errors);
      setNotice({ tone: "error", text: payload.message });
      setStep(1);
      setPhase("idle");
      setCode("");
      setSlugStatus({ kind: "idle" });
      setFocusTarget(payload.errors.slug ? "slug" : "email");
      return;
    }

    if (payload.reason === "OTP_EXPIRED") {
      setPhase("expired");
    } else if (payload.reason === "OTP_ATTEMPTS_EXHAUSTED") {
      setPhase("exhausted");
    } else {
      setPhase("sent");
    }

    setErrors(payload.errors);
    setNotice({ tone: "error", text: payload.message });

    if (payload.reason === "OTP_EXPIRED" || payload.reason === "OTP_ATTEMPTS_EXHAUSTED") {
      setCode("");
      setTurnstileToken(null);
      setResetSignal((value) => value + 1);
    }

    const first = firstErrorField(payload.errors, OTP_FIELD_ORDER);
    if (first === "code") setFocusTarget("code");
  }, [signupFetcher.data, signupFetcher.state]);

  function goNext() {
    if (step === 1) {
      const stepErrors = validateOwnerDraft(draft, slugStatus);
      if (hasErrors(stepErrors)) {
        setErrors(stepErrors);
        setFocusTarget(firstErrorField(stepErrors, OWNER_FIELD_ORDER));
        return;
      }
      setErrors({});
      setNotice(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      const stepErrors = validateThemeStep(themeId, themeIds);
      if (hasErrors(stepErrors)) {
        setErrors(stepErrors);
        setFocusTarget(firstErrorField(stepErrors, THEME_FIELD_ORDER));
        return;
      }
      setErrors({});
      setNotice(null);
      setStep(3);
    }
  }

  function goBack() {
    if (step === 1) return;
    setErrors({});
    setNotice(null);
    if (step === 3) {
      setPhase("idle");
      setCode("");
      setResendDeadline(null);
    }
    setStep((current) => (current > 1 ? ((current - 1) as SignupStep) : current));
  }

  function sendOtp() {
    const stepErrors = validateOtpRequest(turnstileToken);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setNotice(null);
    setPhase("sending");
    otpFetcher.submit(
      {
        intent: "otp",
        email: draft.email.trim(),
        slug: draft.slug,
        turnstileToken: turnstileToken ?? "",
      },
      { method: "post" },
    );
  }

  function verifyAndCreate() {
    const stepErrors = validateOtpCode(code);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      setFocusTarget("code");
      return;
    }
    setErrors({});
    setNotice(null);
    setPhase("verifying");
    signupFetcher.submit(
      {
        intent: "signup",
        name: draft.name.trim(),
        email: draft.email.trim(),
        password: draft.password,
        storeName: draft.storeName.trim(),
        slug: draft.slug,
        currency: draft.currency,
        themeId: themeId ?? "",
        primaryColor: /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "",
        code: code.trim(),
      },
      { method: "post" },
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || step === 4) return;
    if (step < 3) {
      goNext();
      return;
    }
    if (phase === "sent" || phase === "verifying") {
      verifyAndCreate();
      return;
    }
    sendOtp();
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#registro"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text focus:shadow-md"
      >
        Saltar al formulario
      </a>
      <SiteHeader compact />

      <main id="registro" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Crea tu catálogo
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Cuatro pasos: tus datos, el tema, la verificación por correo y tu tienda
            publicada. No guardamos nada hasta que confirmes el código.
          </p>
        </div>

        <div className="mb-6">
          <Stepper current={step} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-lg font-semibold text-text outline-none"
          >
            {step === 1 && "Tus datos y tu tienda"}
            {step === 2 && "Elige el tema"}
            {step === 3 && "Verifica tu correo"}
            {step === 4 && "Todo listo"}
          </h2>

          {errorCount > 0 && step !== 4 ? (
            <div
              role="alert"
              className="mt-3 rounded-md border border-danger bg-bg px-3 py-2 text-sm text-danger"
            >
              Revisa {errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`}{" "}
              antes de continuar.
            </div>
          ) : null}

          <form className="mt-5" onSubmit={handleSubmit} noValidate>
            {step === 1 ? (
              <OwnerStep
                draft={draft}
                onChange={updateDraft}
                errors={errors}
                slugStatus={slugStatus}
                storeDomain={storeDomain}
              />
            ) : null}

            {step === 2 ? (
              themeMetadata.length === 0 ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  No pudimos cargar los temas. Recarga la página para volver a
                  intentarlo.
                </p>
              ) : (
                <ThemePicker
                  themes={themeMetadata}
                  value={themeId}
                  primaryColor={primaryColor}
                  onChange={(nextThemeId) => {
                    setThemeId(nextThemeId);
                    if (!colorCustomized) {
                      const nextDefault = themeMetadata.find((t) => t.id === nextThemeId)?.defaultPrimaryColor;
                      if (nextDefault) setPrimaryColor(nextDefault);
                    }
                  }}
                  onPrimaryColorChange={(hex) => {
                    setColorCustomized(true);
                    setPrimaryColor(hex);
                  }}
                  error={errors.theme}
                />
              )
            ) : null}

            {step === 3 ? (
              <OtpStep
                email={draft.email}
                slug={draft.slug}
                storeDomain={storeDomain}
                siteKey={turnstileSiteKey}
                token={turnstileToken}
                onToken={setTurnstileToken}
                resetSignal={resetSignal}
                phase={phase}
                code={code}
                onCode={setCode}
                errors={errors}
                notice={notice?.text ?? null}
                noticeTone={notice?.tone ?? "info"}
                secondsLeft={secondsLeft}
                expiresInMinutes={expiresInMinutes}
                busy={busy}
                onSend={sendOtp}
                onEdit={() => {
                  setErrors({});
                  setNotice(null);
                  setPhase("idle");
                  setStep(1);
                }}
                onTurnstileError={() =>
                  setNotice({
                    tone: "error",
                    text: "No pudimos cargar la verificación anti-bot. Revisa tu conexión y vuelve a intentarlo.",
                  })
                }
              />
            ) : null}

            {step === 4 && result ? <DoneStep result={result} /> : null}

            {step < 4 ? (
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={goBack}
                  disabled={step === 1 || busy}
                >
                  Anterior
                </Button>

                {step < 3 ? (
                  <Button type="submit" size="lg">
                    Continuar
                  </Button>
                ) : (
                  <p className="text-xs text-text-muted sm:text-right">
                    El código caduca en {expiresInMinutes} minutos.
                  </p>
                )}
              </div>
            ) : null}
          </form>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-text-muted">
          Al crear tu catálogo aceptas los{" "}
          <a className="underline underline-offset-4 hover:text-text" href="/terminos">
            términos del servicio
          </a>{" "}
          y el{" "}
          <a className="underline underline-offset-4 hover:text-text" href="/privacidad">
            aviso de privacidad
          </a>
          . Tus datos de acceso solo viajan a nuestro servidor al confirmar el código.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
