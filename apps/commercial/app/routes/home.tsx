import { useRouteLoaderData } from "react-router";

import { Button } from "@tucatalogo/ui";

import type { Route } from "./+types/home";
import type { loader as rootLoader } from "~/root";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { StorefrontPreview } from "~/components/storefront-preview";

export function meta(_: Route.MetaArgs) {
  const title = "TuCatálogo · Tu catálogo con pedidos por WhatsApp";
  const description =
    "Crea el catálogo de tu tienda en minutos: enlace propio, cinco temas con versión clara y oscura, panel en español y pedidos directos a tu WhatsApp.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "TuCatálogo" },
    { property: "og:locale", content: "es_ES" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

const BENEFITS = [
  {
    icon: "link",
    title: "Tu tienda en un enlace propio",
    text: "Cada catálogo vive en un identificador que eliges tú. Sin dominio, sin hosting y sin instalar nada.",
  },
  {
    icon: "whatsapp",
    title: "Pedidos directo a WhatsApp",
    text: "Cada producto abre el chat con el mensaje ya escrito: producto, precio y nombre de la tienda.",
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
      "No. Tu tienda queda publicada en tu-slug.luisrivas.site y ese es el enlace que compartes. No hay que configurar DNS ni certificados.",
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

function BenefitIcon({ name }: { name: (typeof BENEFITS)[number]["icon"] }) {
  const paths: Record<typeof name, React.ReactNode> = {
    link: (
      <>
        <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
        <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
        <path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1L12 14c-1-.4-2-1.4-2.4-2.4l1.5-1.5-1-2Z" />
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
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

export default function Home() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const themes = root?.themeMetadata ?? [];
  const heroTheme = themes[0];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text focus:shadow-md"
      >
        Saltar al contenido
      </a>

      <SiteHeader />

      <main id="contenido" className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16 lg:pb-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-primary-subtle px-3 py-1 text-xs font-medium text-primary">
                Catálogos para vender por WhatsApp
              </p>

              <h1 className="mt-5 font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-text sm:text-5xl">
                Tu catálogo online, listo para vender por{" "}
                <span className="text-primary">WhatsApp</span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
                Crea la tienda de tu negocio en minutos: sube tus productos, elige uno
                de los cinco temas y comparte un enlace propio. Los pedidos llegan
                directo a tu WhatsApp, con el producto y el precio ya escritos.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <a href="/registro">Crear mi catálogo gratis</a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#temas">Ver los 5 temas</a>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
                <li>Sin tarjeta</li>
                <li aria-hidden="true" className="text-text-muted">
                  ·
                </li>
                <li>Sin instalar nada</li>
                <li aria-hidden="true" className="text-text-muted">
                  ·
                </li>
                <li>Todo en español</li>
              </ul>
            </div>

            <div className="lg:pl-6">
              <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                <div
                  aria-hidden="true"
                  className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-2"
                >
                  <span className="size-2 rounded-full bg-border-strong" />
                  <span className="size-2 rounded-full bg-border-strong" />
                  <span className="size-2 rounded-full bg-border-strong" />
                  <span className="ml-2 truncate text-[10px] text-text-muted">
                    mi-tienda.luisrivas.site
                  </span>
                </div>
                {heroTheme ? (
                  <StorefrontPreview themeId={heroTheme.id} />
                ) : (
                  <div className="p-4 text-sm text-text-muted">
                    Preview no disponible.
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-text-muted">
                {heroTheme
                  ? `Ejemplo real del tema ${heroTheme.name}. Los precios se muestran en la moneda que elijas al crear tu tienda.`
                  : "No pudimos cargar la vista previa del tema."}
              </p>
            </div>
          </div>
        </section>

        {/* Beneficios */}
        <section id="beneficios" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
            <h2 className="max-w-2xl font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Todo lo que necesitas para vender, sin lo que no vas a usar
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
              Sin carrito, sin pasarela de pago y sin comisiones por pedido. Tu
              catálogo muestra, tu WhatsApp cierra la venta.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit.title}
                  className="rounded-lg border border-border bg-bg p-5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-primary-subtle text-primary">
                    <BenefitIcon name={benefit.icon} />
                  </span>
                  <h3 className="mt-3 font-heading text-base font-semibold text-text">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                    {benefit.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Temas */}
        <section id="temas" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                  Cinco temas, el mismo catálogo bien hecho
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
                  Misma estructura y misma grilla: lo que cambia es el sistema de
                  diseño (color, tipografía, radios y sombras). Cada tema tiene versión
                  clara y oscura.
                </p>
              </div>
              <Button asChild variant="secondary" size="md" className="shrink-0">
                <a href="/registro">Elegir el mío</a>
              </Button>
            </div>

            {themes.length === 0 ? (
              <p role="alert" className="mt-8 text-sm font-medium text-danger">
                No pudimos cargar los temas. Recarga la página para verlos.
              </p>
            ) : (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((theme) => (
                  <li
                    key={theme.id}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="overflow-hidden rounded-md border border-border">
                      <StorefrontPreview themeId={theme.id} />
                    </div>

                    <div>
                      <h3 className="font-heading text-base font-semibold text-text">
                        {theme.name}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">
                        {theme.description}
                      </p>
                    </div>

                    <ul aria-label={`Colores de ${theme.name}`} className="flex gap-1.5">
                      {theme.swatches.map((color) => (
                        <li
                          key={color}
                          className="size-6 rounded-full border border-border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </ul>

                    <ul className="flex flex-wrap gap-1.5">
                      {theme.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted"
                        >
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              De la idea al enlace en tres pasos
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
              El registro son cuatro pasos: datos, tema, verificación por correo y
              confirmación. No se guarda nada hasta que confirmas el código.
            </p>

            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-lg border border-border bg-bg p-5">
                  <span
                    aria-hidden="true"
                    className="grid size-9 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-on-primary"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-heading text-base font-semibold text-text">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Preguntas frecuentes
            </h2>

            <div className="mt-6 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-border bg-surface p-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="text-text-muted transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="bg-bg">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
            <div className="rounded-lg bg-primary px-6 py-10 text-center text-on-primary sm:px-10">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Tu catálogo puede estar publicado hoy
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-on-primary/90 sm:text-base">
                Crea tu cuenta, elige el tema y verifica tu correo. En unos minutos
                tienes un enlace para compartir y un panel para cargar tus productos.
              </p>
              <div className="mt-6 flex justify-center">
                <Button asChild size="lg" variant="secondary">
                  <a href="/registro">Crear mi catálogo</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
