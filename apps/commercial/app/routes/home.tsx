import { useState } from "react";
import { useRouteLoaderData } from "react-router";

import type { ThemeMetadata } from "@tucatalogo/themes";
import type { ColorMode } from "@tucatalogo/types";
import { Badge, Button, Tabs, TabsList, TabsTrigger } from "@tucatalogo/ui";

import type { Route } from "./+types/home";
import type { loader as rootLoader } from "~/root";

import { RealStorefrontPreview } from "~/components/real-storefront-preview";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { ThemeFontLoader } from "~/components/theme-fonts";
import { commercialMeta } from "~/lib/social";

export const HOME_TITLE = "TuCatálogo · Tu catálogo con pedidos por WhatsApp";
export const HOME_DESCRIPTION =
  "Crea el catálogo de tu tienda en minutos: enlace propio, cinco temas con versión clara y oscura, panel en español y pedidos directos a tu WhatsApp.";

/**
 * El juego de metadatos es completo aquí a propósito: al definir `meta()` en la
 * ruta, el del `root` no se renderiza, así que la imagen OG y compañía tienen
 * que venir con el título y la descripción de la página.
 */
export function meta(_: Route.MetaArgs) {
  return commercialMeta({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
  });
}

/**
 * Beneficio destacado primero: el pedido por WhatsApp es la promesa que cierra
 * la decisión; el resto la sostiene.
 */
const FEATURED_BENEFIT = {
  icon: "whatsapp",
  title: "Pedidos directo a WhatsApp",
  text: "Cada producto abre el chat con el mensaje ya escrito: producto, precio y nombre de la tienda. Sin carrito, sin pasarela y sin comisiones por pedido.",
} as const;

const BENEFITS = [
  {
    icon: "link",
    title: "Tu tienda en un enlace propio",
    text: "Cada catálogo vive en un identificador que eliges tú. Sin dominio, sin hosting y sin instalar nada.",
  },
  {
    icon: "palette",
    title: "Cinco temas con carácter",
    text: "Rosé, Nude Studio, Velvet Noir, Sol de Verano y Urban Slate, todos en claro y oscuro.",
  },
  {
    icon: "panel",
    title: "Panel simple, en español",
    text: "Productos, categorías, portada y ajustes desde el móvil. Puedes suspender o eliminar tu tienda cuando quieras.",
  },
] as const;

const STEPS = [
  {
    title: "Crea tu cuenta y tu tienda",
    text: "Nombre, email, contraseña y el identificador que quieres para tu enlace. Comprobamos al momento si está libre.",
  },
  {
    title: "Elige el tema",
    text: "Ves una preview real de la portada con cada tema y con tu color de marca antes de decidir.",
  },
  {
    title: "Verifica y publica",
    text: "Te enviamos un código de 6 dígitos. Al confirmarlo se crea tu tienda y entras al panel a subir tus productos.",
  },
] as const;

const FAQ = [
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Hoy TuCatálogo es gratuito y no pedimos tarjeta. Si más adelante añadimos planes de pago, tu catálogo actual seguirá funcionando.",
  },
  {
    question: "¿Necesito comprar un dominio?",
    answer:
      "No. Tu tienda queda publicada en tu-slug.tucatalogo.live y ese es el enlace que compartes. No hay que configurar DNS ni certificados.",
  },
  {
    question: "¿Cómo llegan los pedidos?",
    answer:
      "Por WhatsApp. El botón de cada producto abre tu chat con el mensaje preparado; tú confirmas disponibilidad, pago y envío como siempre.",
  },
  {
    question: "¿Puedo cambiar el tema o el color después?",
    answer:
      "Sí. Desde el panel puedes cambiar el tema, el color de marca, el nombre, la moneda y el número de WhatsApp cuando quieras.",
  },
  {
    question: "¿Qué pasa con mi contraseña?",
    answer:
      "La contraseña no se guarda hasta que confirmas el código de tu correo: viaja solo en el formulario y se convierte en un hash al crear la tienda.",
  },
  {
    question: "¿Puedo eliminar mi tienda?",
    answer:
      "Sí. Puedes suspenderla (deja de ser pública) o eliminarla por completo. Tras el borrado, el identificador queda reservado 90 días.",
  },
] as const;

const TRUST_POINTS = ["Sin tarjeta", "Sin instalar nada", "Todo en español"] as const;

/* ------------------------------------------------------------------ *
 * Iconografía propia (SVG, trazo de 1.75, sin emoji ni librerías)
 * ------------------------------------------------------------------ */

type IconName =
  | "whatsapp"
  | "link"
  | "palette"
  | "panel"
  | "check"
  | "lock"
  | "plus"
  | "arrow";

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  whatsapp: (
    <>
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
      <path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1L12 14c-1-.4-2-1.4-2.4-2.4l1.5-1.5-1-2Z" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </>
  ),
  palette: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7c.4.7 0 2.3-3 2.3Z" />
      <path d="M8 10h.01M12 7h.01M16 10h.01" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  check: <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: (
    <>
      <path d="M5 12h13" />
      <path d="m12.5 6 6 6-6 6" />
    </>
  ),
};

function Icon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "size-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Piezas de la landing
 * ------------------------------------------------------------------ */

function HeroPreview({ themes }: { themes: ThemeMetadata[] }) {
  const [selectedId, setSelectedId] = useState<string>(themes[0]?.id ?? "rose");
  const activeTheme = themes.find((t) => t.id === selectedId) ?? themes[0];
  const [mode, setMode] = useState<ColorMode>(
    activeTheme?.defaultPreviewMode ?? "light",
  );

  function handleSelectTheme(theme: ThemeMetadata) {
    setSelectedId(theme.id);
    setMode(theme.defaultPreviewMode);
  }

  return (
    <div className="relative min-w-0">
      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Elegir tema para vista previa">
            {themes.map((t) => {
              const isSelected = t.id === activeTheme?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTheme(t)}
                  aria-pressed={isSelected}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    isSelected
                      ? "border-primary bg-primary-subtle text-primary"
                      : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full border border-border/60"
                    style={{ backgroundColor: t.swatches[0] }}
                  />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <span>{mode === "dark" ? "Modo oscuro" : "Modo claro"}</span>
          </button>
        </div>

        {/* Product-like device frame with the theme's own surface & shadow */}
        <div className="rounded-[calc(var(--radius-lg)+7px)] border border-border/80 bg-surface p-1.5 shadow-md">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <div
              aria-hidden="true"
              className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2.5"
            >
              <span className="flex shrink-0 gap-1.5">
                <span className="size-2 rounded-full bg-border-strong/70" />
                <span className="size-2 rounded-full bg-border-strong/70" />
                <span className="size-2 rounded-full bg-border-strong/70" />
              </span>
              <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-[10px] text-text-muted">
                <Icon name="lock" className="size-2.5 shrink-0" strokeWidth={2.25} />
                <span className="truncate">
                  {activeTheme ? `${activeTheme.id}.tucatalogo.live` : "mi-tienda.tucatalogo.live"}
                </span>
              </span>
            </div>

            {activeTheme ? (
              <>
                <span className="sr-only">
                  Vista previa de la portada del tema {activeTheme.name}.
                </span>
                <RealStorefrontPreview themeId={activeTheme.id} mode={mode} viewport="mobile" />
              </>
            ) : (
              <p className="p-4 text-sm text-text-muted">Preview no disponible.</p>
            )}
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-text-muted">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            {activeTheme
              ? `Vista real del tema ${activeTheme.name} en modo ${mode === "dark" ? "oscuro" : "claro"}. Personaliza el color principal en segundos.`
              : "No pudimos cargar la vista previa del tema."}
          </span>
        </p>
      </div>
    </div>
  );
}

function InteractiveThemeShowcase({ themes }: { themes: ThemeMetadata[] }) {
  const [selectedId, setSelectedId] = useState<string>(themes[0]?.id ?? "rose");
  const activeTheme = themes.find((t) => t.id === selectedId) ?? themes[0];
  const [mode, setMode] = useState<ColorMode>(
    activeTheme?.defaultPreviewMode ?? "light",
  );
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  if (!activeTheme) {
    return null;
  }

  function handleSelect(theme: ThemeMetadata) {
    setSelectedId(theme.id);
    setMode(theme.defaultPreviewMode);
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Seleccionar tema"
          className="flex flex-wrap gap-2"
        >
          {themes.map((theme) => {
            const active = theme.id === activeTheme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelect(theme)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  active
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-border bg-surface text-text hover:border-border-strong",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border border-white/40"
                  style={{ backgroundColor: theme.swatches[0] }}
                />
                <span>{theme.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ColorMode)}>
            <TabsList>
              <TabsTrigger value="light">Claro</TabsTrigger>
              <TabsTrigger value="dark">Oscuro</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs
            value={viewport}
            onValueChange={(v) => setViewport(v as "desktop" | "mobile")}
          >
            <TabsList>
              <TabsTrigger value="desktop">Escritorio</TabsTrigger>
              <TabsTrigger value="mobile">Móvil</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <article className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-md lg:grid lg:grid-cols-[1.35fr_0.65fr]">
        <div className="flex items-center justify-center bg-surface-2 p-4 sm:p-6">
          <div
            className={[
              "w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm transition-all",
              viewport === "mobile" ? "max-w-[340px]" : "max-w-full",
            ].join(" ")}
          >
            <div
              aria-hidden="true"
              className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2"
            >
              <span className="flex shrink-0 gap-1">
                <span className="size-2 rounded-full bg-border-strong/70" />
                <span className="size-2 rounded-full bg-border-strong/70" />
                <span className="size-2 rounded-full bg-border-strong/70" />
              </span>
              <span className="ml-1 truncate rounded-full bg-surface px-2.5 py-0.5 text-[10px] text-text-muted">
                {activeTheme.id}.tucatalogo.live
              </span>
            </div>

            <RealStorefrontPreview
              themeId={activeTheme.id}
              mode={mode}
              viewport={viewport}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-text">
                {activeTheme.name}
              </h3>
              {activeTheme.id === "rose" ? (
                <Badge variant="primary">Por defecto</Badge>
              ) : null}
              {activeTheme.defaultPreviewMode === "dark" ? (
                <Badge variant="neutral">Ideal oscuro</Badge>
              ) : null}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {activeTheme.description}
            </p>

            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Tipografía
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {activeTheme.fonts.heading} + {activeTheme.fonts.body}
              </p>

              <p className="mt-4 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Paleta base
              </p>
              <ul
                aria-label={`Colores de ${activeTheme.name}`}
                className="mt-2 flex gap-2"
              >
                {activeTheme.swatches.map((color) => (
                  <li
                    key={color}
                    className="size-7 rounded-full border border-border shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </ul>

              <ul className="mt-5 flex flex-wrap gap-1.5">
                {activeTheme.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-5">
            <Button asChild size="lg" className="w-full">
              <a href={`/registro?tema=${activeTheme.id}`}>
                Crear tienda con {activeTheme.name}
              </a>
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Página
 * ------------------------------------------------------------------ */

export default function Home() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const themes = root?.themeMetadata ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-primary focus:px-3.5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-md"
      >
        Saltar al contenido
      </a>

      <SiteHeader />

      <main id="contenido" className="flex-1">
        <ThemeFontLoader />

        {/* ---------------------------------------------------------- Hero */}
        <section className="relative bg-hero">
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-14 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-14 lg:pt-20 lg:pb-24">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-primary-subtle px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-primary uppercase">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                Catálogos para vender por WhatsApp
              </p>

              <h1 className="mt-6 font-display text-[clamp(2.5rem,6.2vw,4rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-text">
                Tu catálogo online, listo para vender por{" "}
                <span className="whitespace-nowrap text-primary">WhatsApp</span>
              </h1>

              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-text-muted sm:text-lg">
                Crea la tienda de tu negocio en minutos: sube tus productos, elige uno
                de los cinco temas y comparte un enlace propio. Los pedidos llegan
                directo a tu WhatsApp, con el producto y el precio ya escritos.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg">
                  <a href="/registro">Crear mi catálogo gratis</a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#temas">Ver los 5 temas</a>
                </Button>
              </div>

              <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-text-muted sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2.5">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="inline-flex items-center gap-1.5">
                    <Icon name="check" className="size-4 shrink-0 text-primary" strokeWidth={2} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <HeroPreview themes={themes} />
          </div>
        </section>

        {/* ---------------------------------------------------- Beneficios */}
        <section id="beneficios" className="bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                Lo esencial, bien hecho
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.12] font-semibold tracking-tight text-balance text-text">
                Todo lo que necesitas para vender, sin lo que no vas a usar
              </h2>
              <p className="mt-4 text-base leading-relaxed text-text-muted">
                Sin carrito, sin pasarela de pago y sin comisiones por pedido. Tu
                catálogo muestra, tu WhatsApp cierra la venta.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
              <article className="relative overflow-hidden rounded-[var(--radius-lg)] bg-primary px-6 py-8 text-on-primary shadow-md sm:px-8 sm:py-10">
                <Icon
                  name="whatsapp"
                  className="pointer-events-none absolute -right-5 -bottom-6 size-40 text-on-primary/10"
                  strokeWidth={1.25}
                />
                <span className="relative inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-on-primary/15">
                  <Icon name="whatsapp" className="size-6" />
                </span>
                <h3 className="relative mt-6 font-display text-2xl font-semibold tracking-tight">
                  {FEATURED_BENEFIT.title}
                </h3>
                <p className="relative mt-3 max-w-sm text-[15px] leading-relaxed text-on-primary">
                  {FEATURED_BENEFIT.text}
                </p>
              </article>

              <ul className="divide-y divide-border">
                {BENEFITS.map((benefit) => (
                  <li
                    key={benefit.title}
                    className="flex gap-4 py-5 first:pt-0 last:pb-0"
                  >
                    <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-subtle text-primary">
                      <Icon name={benefit.icon} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-text">
                        {benefit.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                        {benefit.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Temas */}
        <section id="temas" className="bg-wash">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                  Cinco direcciones, un solo motor
                </p>
                <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.12] font-semibold tracking-tight text-balance text-text">
                  Cinco temas, el mismo catálogo bien hecho
                </h2>
                <p className="mt-4 text-base leading-relaxed text-text-muted">
                  Misma estructura y misma grilla: lo que cambia es el sistema de
                  diseño (color, tipografía, radios y sombras). Cada tema tiene versión
                  clara y oscura.
                </p>
              </div>
              <Button asChild variant="secondary" size="md" className="shrink-0 sm:h-11">
                <a href="/registro">Elegir el mío</a>
              </Button>
            </div>

            {themes.length === 0 ? (
              <p role="alert" className="mt-10 text-sm font-medium text-danger">
                No pudimos cargar los temas. Recarga la página para verlos.
              </p>
            ) : (
              <InteractiveThemeShowcase themes={themes} />
            )}
          </div>
        </section>

        {/* ------------------------------------------------ Cómo funciona */}
        <section id="como-funciona" className="bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                Registro guiado
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.12] font-semibold tracking-tight text-balance text-text">
                De la idea a tu enlace en minutos
              </h2>
              <p className="mt-4 text-base leading-relaxed text-text-muted">
                El registro son cuatro pasos: datos, tema, verificación por correo y
                confirmación. No se guarda nada hasta que confirmas el código.
              </p>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-3 md:gap-5">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-[var(--radius-lg)] border border-border bg-surface p-5 pt-8 shadow-sm sm:p-6 sm:pt-9"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-3.5 left-5 grid size-9 place-items-center rounded-full bg-primary font-display text-sm font-semibold text-on-primary shadow-sm sm:left-6"
                  >
                    {index + 1}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-text">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-8 flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface/70 px-4 py-3.5 text-sm leading-relaxed text-text-muted sm:items-center">
              <Icon
                name="lock"
                className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0"
                strokeWidth={1.9}
              />
              <span>
                Tu contraseña y los datos de la tienda no se guardan hasta que
                confirmas el código de 6 dígitos.
              </span>
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- FAQ */}
        <section id="preguntas" className="bg-bg">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14 lg:py-24">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                Antes de empezar
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.12] font-semibold tracking-tight text-balance text-text">
                Preguntas frecuentes
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-text-muted">
                Lo que nos preguntan quienes están a punto de publicar su catálogo.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[var(--radius-md)] border border-border bg-surface px-5 transition-colors open:border-border-strong/60 open:shadow-sm"
                >
                  <summary className="marker-hidden flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] leading-snug font-semibold text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-text-muted transition-transform duration-200 group-open:rotate-45"
                    >
                      <Icon name="plus" className="size-4" strokeWidth={2} />
                    </span>
                  </summary>
                  <p className="max-w-prose pb-5 text-sm leading-relaxed text-text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- CTA final */}
        <section className="bg-bg">
          <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
            <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-cta px-6 py-12 text-center text-on-primary shadow-lg sm:px-10 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_0%,var(--color-on-primary),transparent_65%)] opacity-[0.08]"
              />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl font-display text-[clamp(1.75rem,3.8vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-balance">
                  Tu catálogo puede estar publicado hoy
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-on-primary">
                  Crea tu cuenta, elige el tema y verifica tu correo. En unos minutos
                  tienes un enlace para compartir y un panel para cargar tus productos.
                </p>
                <div className="mt-8 flex justify-center">
                  <Button asChild size="lg" variant="secondary" className="shadow-md">
                    <a href="/registro">Crear mi catálogo</a>
                  </Button>
                </div>
                <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-on-primary">
                  <Icon name="check" className="size-4 shrink-0" strokeWidth={2} />
                  Gratis, sin tarjeta y sin instalar nada
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
