import { useState } from "react";
import { Input, Select, cn } from "@tucatalogo/ui";

import { CURRENCY_OPTIONS } from "./messages";
import { slugDomain } from "./slug";
import { FieldShell } from "./field";
import type { FieldErrors, OwnerDraft, SlugStatus } from "./types";

function slugStatusText(status: SlugStatus, draft: OwnerDraft, domain: string) {
  switch (status.kind) {
    case "checking":
      return { tone: "muted" as const, text: "Comprobando disponibilidad…" };
    case "available":
      return status.slug === draft.slug
        ? { tone: "success" as const, text: `Disponible: ${status.storefront}` }
        : { tone: "muted" as const, text: "Comprobando disponibilidad…" };
    case "unavailable":
      return status.slug === draft.slug
        ? { tone: "danger" as const, text: status.message }
        : { tone: "muted" as const, text: "Comprobando disponibilidad…" };
    default:
      return {
        tone: "muted" as const,
        text: `Tu tienda será ${slugDomain(draft.slug, domain)}`,
      };
  }
}

const toneClass = {
  muted: "text-text-muted",
  success: "text-success",
  danger: "text-danger",
} as const;

export function OwnerStep({
  draft,
  onChange,
  errors,
  slugStatus,
  storeDomain,
}: {
  draft: OwnerDraft;
  onChange: (patch: Partial<OwnerDraft>) => void;
  errors: FieldErrors;
  slugStatus: SlugStatus;
  storeDomain: string;
}) {
  const status = slugStatusText(slugStatus, draft, storeDomain);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-text">Tus datos</legend>

        <FieldShell id="signup-name" label="Nombre y apellido" error={errors.name}>
          {({ describedBy, invalid }) => (
            <Input
              id="signup-name"
              name="name"
              size="lg"
              autoComplete="name"
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </FieldShell>

        <FieldShell
          id="signup-email"
          label="Email"
          hint="Te enviaremos un código de 6 dígitos para verificar la cuenta."
          error={errors.email}
        >
          {({ describedBy, invalid }) => (
            <Input
              id="signup-email"
              name="email"
              type="email"
              size="lg"
              inputMode="email"
              autoComplete="email"
              value={draft.email}
              onChange={(event) => onChange({ email: event.target.value })}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </FieldShell>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldShell
            id="signup-password"
            label="Contraseña"
            hint="Entre 8 y 128 caracteres."
            error={errors.password}
          >
            {({ describedBy, invalid }) => (
              <div className="relative">
                <Input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  size="lg"
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={(event) => onChange({ password: event.target.value })}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            )}
          </FieldShell>

          <FieldShell
            id="signup-password-confirm"
            label="Repite la contraseña"
            error={errors.passwordConfirm}
          >
            {({ describedBy, invalid }) => (
              <Input
                id="signup-password-confirm"
                name="passwordConfirm"
                type={showPassword ? "text" : "password"}
                size="lg"
                autoComplete="new-password"
                value={draft.passwordConfirm}
                onChange={(event) => onChange({ passwordConfirm: event.target.value })}
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
            )}
          </FieldShell>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-text">Tu tienda</legend>

        <FieldShell
          id="signup-store-name"
          label="Nombre de la tienda"
          hint="Aparece en la cabecera del catálogo y en los mensajes de WhatsApp."
          error={errors.storeName}
        >
          {({ describedBy, invalid }) => (
            <Input
              id="signup-store-name"
              name="storeName"
              size="lg"
              autoComplete="organization"
              value={draft.storeName}
              onChange={(event) => onChange({ storeName: event.target.value })}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </FieldShell>

        <FieldShell
          id="signup-slug"
          label="Identificador de la tienda"
          hint={
            <span>
              Solo minúsculas, números y guiones. Tu enlace será{" "}
              <span className="font-medium text-text">
                {slugDomain(draft.slug, storeDomain)}
              </span>
              .
            </span>
          }
          error={errors.slug}
        >
          {({ describedBy, invalid }) => (
            <div>
              <Input
                id="signup-slug"
                name="slug"
                size="lg"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="mi-tienda"
                value={draft.slug}
                onChange={(event) => onChange({ slug: event.target.value })}
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
              <p
                aria-live="polite"
                className={cn("mt-1.5 text-xs", toneClass[status.tone])}
              >
                {status.text}
              </p>
            </div>
          )}
        </FieldShell>

        <FieldShell
          id="signup-currency"
          label="Moneda"
          hint="Los precios se guardan en la moneda de tu tienda y no se convierten."
          error={errors.currency}
        >
          {({ describedBy, invalid }) => (
            <Select
              id="signup-currency"
              name="currency"
              size="lg"
              value={draft.currency}
              onChange={(event) =>
                onChange({ currency: event.target.value as OwnerDraft["currency"] })
              }
              aria-describedby={describedBy}
              invalid={invalid}
              required
            >
              <option value="" disabled>
                Elige la moneda
              </option>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FieldShell>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <input
            id="signup-terms"
            name="terms"
            type="checkbox"
            checked={draft.acceptedTerms}
            onChange={(event) => onChange({ acceptedTerms: event.target.checked })}
            aria-invalid={Boolean(errors.terms) || undefined}
            aria-describedby={errors.terms ? "signup-terms-error" : undefined}
            className="mt-0.5 size-4 shrink-0 rounded-sm border border-border-strong accent-[var(--color-primary)]"
            required
          />
          <label htmlFor="signup-terms" className="text-sm leading-relaxed text-text">
            Acepto los términos del servicio y el aviso de privacidad.
          </label>
        </div>

        <p className="pl-[26px] text-xs text-text-muted">
          Puedes leerlos antes en una nueva pestaña:{" "}
          <a
            className="underline underline-offset-4 hover:text-text"
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
          >
            términos
          </a>{" "}
          y{" "}
          <a
            className="underline underline-offset-4 hover:text-text"
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
          >
            privacidad
          </a>
          .
        </p>

        {errors.terms ? (
          <p id="signup-terms-error" className="text-xs font-medium text-danger">
            {errors.terms}
          </p>
        ) : null}
      </div>
    </div>
  );
}
