import { Button } from "@tucatalogo/ui";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import {
  ImageNormalizationError,
  formatBytes,
  normalizeHeroDesktop,
  normalizeHeroMobile,
  normalizeLogo,
  normalizeProductImage,
  validateSourceImage,
} from "~/lib/image-normalize";
import type { PanelActionData } from "~/lib/panel";

import { Field, FormError, PanelAlert } from "./panel-ui";

/**
 * Subida de imágenes con normalización **en el navegador** antes de enviar el
 * multipart al action same-origin. Sin JS no se sube nada: el action rechaza
 * cualquier archivo que no sea WebP (no hay fallback de formato).
 */

function useObjectPreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return url;
}

function errorMessage(error: unknown): string {
  if (error instanceof ImageNormalizationError) return error.message;
  if (error instanceof Error) return error.message;
  return "No pudimos procesar la imagen.";
}

export function ProductImageUploader({
  productName,
  currentCount,
  maxImages,
}: {
  productName: string;
  currentCount: number;
  maxImages: number;
}) {
  const fetcher = useFetcher<PanelActionData>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(productName);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const preview = useObjectPreview(file);
  const busy = phase !== "idle" || fetcher.state !== "idle";
  const atLimit = currentCount >= maxImages;

  useEffect(() => {
    if (fetcher.data?.ok) {
      setFile(null);
      setPhase("idle");
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    if (fetcher.data?.formError) setPhase("idle");
  }, [fetcher.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (atLimit) {
      setError(`Este producto ya tiene ${maxImages} imágenes. Elimina una antes de subir otra.`);
      return;
    }
    if (!file) {
      setError("Elige una imagen.");
      return;
    }

    const invalid = validateSourceImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (alt.trim().length === 0) {
      setError("Describe la imagen: es obligatorio para accesibilidad.");
      return;
    }

    setPhase("optimizing");
    try {
      const { full, thumb } = await normalizeProductImage(file);
      const form = new FormData();
      form.set("intent", "upload-image");
      form.set("alt", alt.trim());
      form.set("width", String(full.width));
      form.set("height", String(full.height));
      form.set("full", new File([full.blob], "full.webp", { type: "image/webp" }));
      form.set("thumb", new File([thumb.blob], "thumb.webp", { type: "image/webp" }));

      setPhase("uploading");
      // `formEncType` es obligatorio: sin él React Router serializa el FormData
      // como urlencoded y **los File se pierden** (el action responde 400).
      fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" encType="multipart/form-data">
      <p className="text-sm text-text-muted">
        {currentCount} de {maxImages} imágenes. Se convierten a WebP de 1600 px y miniatura de
        600 px en tu navegador; el EXIF se elimina.
      </p>

      {atLimit ? (
        <PanelAlert tone="info" title="Límite alcanzado">
          <p>Para subir otra imagen, elimina una de las existentes.</p>
        </PanelAlert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field id="product-image-file" label="Archivo" hint="JPG, PNG o WebP de hasta 2 MB." required>
          <input
            ref={inputRef}
            id="product-image-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || atLimit}
            onChange={(event) => {
              setError(null);
              setFile(event.currentTarget.files?.[0] ?? null);
            }}
            className="block w-full cursor-pointer rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary-subtle)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text disabled:opacity-60"
          />
        </Field>

        <Field id="product-image-alt" label="Texto alternativo" hint="Qué se ve en la imagen." required>
          <input
            id="product-image-alt"
            name="alt"
            value={alt}
            maxLength={180}
            disabled={busy}
            onChange={(event) => setAlt(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
      </div>

      {preview ? (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="Vista previa de la imagen elegida"
            className="size-20 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border object-cover"
          />
          <p className="text-xs text-text-muted">
            {file ? `${file.name} · ${formatBytes(file.size)}` : null}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || atLimit || !file}>
          {phase === "optimizing"
            ? "Optimizando…"
            : phase === "uploading" || fetcher.state !== "idle"
              ? "Subiendo…"
              : "Subir imagen"}
        </Button>
        {busy ? (
          <span role="status" className="text-xs text-text-muted">
            No cierres esta página mientras se procesa.
          </span>
        ) : null}
      </div>

      {error ? <FormError message={error} /> : null}
      {fetcher.data?.formError ? <FormError message={fetcher.data.formError} /> : null}
      {fetcher.data?.ok && fetcher.data.message ? (
        <p role="status" className="text-sm font-medium">
          {fetcher.data.message}
        </p>
      ) : null}
    </form>
  );
}

export function LogoUploader({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const fetcher = useFetcher<PanelActionData>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const preview = useObjectPreview(file);
  const busy = phase !== "idle" || fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) {
      setFile(null);
      setPhase("idle");
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    if (fetcher.data?.formError) setPhase("idle");
  }, [fetcher.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Elige un archivo para el logo.");
      return;
    }
    const invalid = validateSourceImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setPhase("optimizing");
    try {
      const logo = await normalizeLogo(file);
      const form = new FormData();
      form.set("intent", "upload-logo");
      form.set("logo", new File([logo.blob], "logo.webp", { type: "image/webp" }));
      setPhase("uploading");
      fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" encType="multipart/form-data">
      <div className="flex items-center gap-3">
        {preview || currentLogoUrl ? (
          <img
            src={preview ?? currentLogoUrl ?? ""}
            alt={preview ? "Vista previa del logo" : "Logo actual"}
            width={64}
            height={64}
            className="size-16 rounded-full border-[length:var(--border-width)] border-border bg-surface-2 object-cover"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-full border border-dashed border-border-strong text-xs text-text-muted">
            Sin logo
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">Logo de la tienda</p>
          <p className="text-xs text-text-muted">WebP cuadrado-ish, máximo 1600 px y 2 MB.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        id="store-logo"
        name="logo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          setError(null);
          setFile(event.currentTarget.files?.[0] ?? null);
        }}
        className="block w-full cursor-pointer rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary-subtle)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text disabled:opacity-60"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" disabled={busy || !file}>
          {phase === "optimizing"
            ? "Optimizando…"
            : phase === "uploading" || fetcher.state !== "idle"
              ? "Subiendo…"
              : "Actualizar logo"}
        </Button>
      </div>

      {error ? <FormError message={error} /> : null}
      {fetcher.data?.formError ? <FormError message={fetcher.data.formError} /> : null}
      {fetcher.data?.ok && fetcher.data.message ? (
        <p role="status" className="text-sm font-medium">
          {fetcher.data.message}
        </p>
      ) : null}
    </form>
  );
}

function HeroFileField({
  id,
  label,
  hint,
  file,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint} required>
      <input
        id={id}
        name={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.files?.[0] ?? null)}
        className="block w-full cursor-pointer rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary-subtle)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text disabled:opacity-60"
      />
      <p className="text-xs text-text-muted">{file ? file.name : "Sin archivo"}</p>
    </Field>
  );
}

function useHeroNormalization() {
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "optimizing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function buildImages(): Promise<FormData | null> {    setError(null);
    if (!desktopFile || !mobileFile) {
      setError("El slide necesita las dos imágenes: escritorio y móvil.");
      return null;
    }
    for (const candidate of [desktopFile, mobileFile]) {
      const invalid = validateSourceImage(candidate);
      if (invalid) {
        setError(invalid);
        return null;
      }
    }

    setPhase("optimizing");
    try {
      const [desktop, mobile] = await Promise.all([
        normalizeHeroDesktop(desktopFile),
        normalizeHeroMobile(mobileFile),
      ]);
      const form = new FormData();
      form.set("desktop", new File([desktop.blob], "desktop.webp", { type: "image/webp" }));
      form.set("mobile", new File([mobile.blob], "mobile.webp", { type: "image/webp" }));
      setPhase("idle");
      return form;
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase("idle");
      return null;
    }
  }

  return {
    desktopFile,
    mobileFile,
    setDesktopFile,
    setMobileFile,
    phase,
    error,
    setError,
    buildImages,
    reset() {
      setDesktopFile(null);
      setMobileFile(null);
      setError(null);
      setPhase("idle");
    },
  };
}

/**
 * Alta de slide: dos archivos de entrada (encuadre escritorio y encuadre móvil)
 * se normalizan por separado y se envían como `desktop` + `mobile`.
 */
export function HeroCreateForm({
  disabled,
  defaults,
}: {
  disabled: boolean;
  defaults: { title: string; subtitle: string; ctaLabel: string; ctaUrl: string };
}) {
  const fetcher = useFetcher<PanelActionData>();
  const [title, setTitle] = useState(defaults.title);
  const [subtitle, setSubtitle] = useState(defaults.subtitle);
  const [ctaLabel, setCtaLabel] = useState(defaults.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(defaults.ctaUrl);
  const [isActive, setIsActive] = useState(true);
  const hero = useHeroNormalization();
  const busy = hero.phase !== "idle" || fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) {
      setTitle("");
      setSubtitle("");
      setCtaLabel("");
      setCtaUrl("");
      setIsActive(true);
      hero.reset();
    }
  }, [fetcher.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const images = await hero.buildImages();
    if (!images) return;
    images.set("intent", "create-hero");
    images.set("title", title);
    images.set("subtitle", subtitle);
    images.set("ctaLabel", ctaLabel);
    images.set("ctaUrl", ctaUrl);
    images.set("isActive", isActive ? "true" : "false");
    // Sin `formEncType` los File del FormData se pierden al serializar.
    fetcher.submit(images, { method: "post", encType: "multipart/form-data" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" encType="multipart/form-data">
      <div className="grid gap-3 sm:grid-cols-2">
        <HeroFileField
          id="hero-desktop"
          label="Imagen de escritorio"
          hint="Se recorta a 1600 × 900."
          file={hero.desktopFile}
          disabled={busy || disabled}
          onChange={hero.setDesktopFile}
        />
        <HeroFileField
          id="hero-mobile"
          label="Imagen de móvil"
          hint="Se recorta a 900 × 1200."
          file={hero.mobileFile}
          disabled={busy || disabled}
          onChange={hero.setMobileFile}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="hero-title" label="Título" hint="Máximo 120 caracteres.">
          <input
            id="hero-title"
            name="title"
            value={title}
            maxLength={120}
            disabled={busy}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
        <Field id="hero-subtitle" label="Subtítulo" hint="Máximo 200 caracteres.">
          <input
            id="hero-subtitle"
            name="subtitle"
            value={subtitle}
            maxLength={200}
            disabled={busy}
            onChange={(event) => setSubtitle(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
        <Field id="hero-cta-label" label="Texto del botón" hint="Si lo dejas vacío, no hay botón.">
          <input
            id="hero-cta-label"
            name="ctaLabel"
            value={ctaLabel}
            maxLength={40}
            disabled={busy}
            onChange={(event) => setCtaLabel(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
        <Field
          id="hero-cta-url"
          label="Enlace del botón"
          hint="https://… o una ruta interna que empiece por /."
        >
          <input
            id="hero-cta-url"
            name="ctaUrl"
            value={ctaUrl}
            maxLength={500}
            disabled={busy}
            onChange={(event) => setCtaUrl(event.currentTarget.value)}
            className="block h-11 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-border-strong bg-surface px-3 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          disabled={busy}
          onChange={(event) => setIsActive(event.currentTarget.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Visible en la tienda
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || disabled}>
          {hero.phase === "optimizing" ? "Optimizando…" : fetcher.state !== "idle" ? "Guardando…" : "Añadir slide"}
        </Button>
        {disabled ? <span className="text-xs text-text-muted">Alcanzaste el máximo de 10 slides.</span> : null}
      </div>

      {hero.error ? <FormError message={hero.error} /> : null}
      {fetcher.data?.formError ? <FormError message={fetcher.data.formError} /> : null}
      {fetcher.data?.ok && fetcher.data.message ? (
        <p role="status" className="text-sm font-medium">
          {fetcher.data.message}
        </p>
      ) : null}
    </form>
  );
}

/** Reemplazo de las dos variantes de un slide existente. */
export function HeroImagesForm({ slideId }: { slideId: string }) {
  const fetcher = useFetcher<PanelActionData>();
  const hero = useHeroNormalization();
  const busy = hero.phase !== "idle" || fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) hero.reset();
  }, [fetcher.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const images = await hero.buildImages();
    if (!images) return;
    images.set("intent", "replace-hero-images");
    images.set("slideId", slideId);
    fetcher.submit(images, { method: "post", encType: "multipart/form-data" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" encType="multipart/form-data">
      <div className="grid gap-2 sm:grid-cols-2">
        <HeroFileField
          id={`hero-desktop-${slideId}`}
          label="Nueva imagen de escritorio"
          hint="1600 × 900."
          file={hero.desktopFile}
          disabled={busy}
          onChange={hero.setDesktopFile}
        />
        <HeroFileField
          id={`hero-mobile-${slideId}`}
          label="Nueva imagen de móvil"
          hint="900 × 1200."
          file={hero.mobileFile}
          disabled={busy}
          onChange={hero.setMobileFile}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {hero.phase === "optimizing" ? "Optimizando…" : fetcher.state !== "idle" ? "Guardando…" : "Reemplazar imágenes"}
        </Button>
      </div>
      {hero.error ? <FormError message={hero.error} /> : null}
      {fetcher.data?.formError ? <FormError message={fetcher.data.formError} /> : null}
      {fetcher.data?.ok && fetcher.data.message ? (
        <p role="status" className="text-sm font-medium">
          {fetcher.data.message}
        </p>
      ) : null}
    </form>
  );
}
