import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import {
  consoleExtraVars,
  fontPreloadHrefs,
  renderAdminStyleTag,
  renderBrandFontFaceCss,
} from "@tucatalogo/themes";

import type { Route } from "./+types/root";
import "./app.css";

import {
  CONSOLE_DEFAULT_DESCRIPTION,
  CONSOLE_DEFAULT_TITLE,
  consoleMeta,
} from "~/lib/social";

/**
 * Tokens del console resueltos en servidor (PLAN §10.4/§10.5): identidad viva
 * compartida con `commercial` (paleta, Fraunces + Figtree, radios y sombras),
 * pero con superficies sobrias porque es un backoffice. Se emite antes del
 * primer pintado, sin JS de cliente y sin FOUC.
 *
 * Sin fallback silencioso (§12): si los tokens no se pueden resolver, se lanza
 * con log. Nunca se sirve el console con los neutros de `@theme`.
 */
function consoleHeadCss(): { themeCss: string; fontFaceCss: string } {
  try {
    const tag = renderAdminStyleTag({
      surface: "console",
      mode: "light",
      extraVars: consoleExtraVars("light"),
    });
    const open = tag.indexOf(">");
    const close = tag.lastIndexOf("</style>");
    if (open === -1 || close === -1 || close <= open) {
      throw new Error("renderAdminStyleTag devolvió un formato inesperado.");
    }
    return {
      themeCss: tag.slice(open + 1, close),
      fontFaceCss: renderBrandFontFaceCss(),
    };
  } catch (error) {
    console.error(
      "[console] no se pudieron resolver los tokens de la superficie",
      error,
    );
    throw error;
  }
}

const CONSOLE_HEAD = consoleHeadCss();

/**
 * El LCP de `/login` es el formulario, no el titular: se precarga solo la
 * familia de UI. Fraunces se carga al usarse (cabeceras y títulos).
 */
const CONSOLE_FONT_PRELOADS = fontPreloadHrefs(["figtree"]);

/**
 * Metadatos del console: `noindex, nofollow` (backoffice, no se indexa) más el
 * juego Open Graph para las previsualizaciones internas, con **URL absoluta de
 * producción** (`https://console.tucatalogo.live/og.png`).
 *
 * React Router v8 renderiza solo el `meta()` de la ruta más profunda: las
 * páginas que definen título repiten el juego con `consoleMeta()` (`/login`).
 */
export function meta(_: Route.MetaArgs) {
  return consoleMeta({
    title: CONSOLE_DEFAULT_TITLE,
    description: CONSOLE_DEFAULT_DESCRIPTION,
    path: "/",
  });
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-surface="console" data-color-mode="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/*
          Favicon del console: el mismo mark, con la teja del acento y la "C"
          en blanco, para distinguirlo de la landing en la misma barra de
          pestañas. `/favicon.ico` redirige (308) al SVG en `routes/favicon.ts`.
        */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="theme-color" content="#F8F5F1" />
        <Meta />
        {CONSOLE_FONT_PRELOADS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        <Links />
        <style
          data-fonts="self-hosted"
          dangerouslySetInnerHTML={{ __html: CONSOLE_HEAD.fontFaceCss }}
        />
        <style
          data-surface-tokens="console"
          dangerouslySetInnerHTML={{ __html: CONSOLE_HEAD.themeCss }}
        />
      </head>
      <body className="min-h-screen bg-bg font-body text-text antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const routeError = isRouteErrorResponse(error);
  const status = routeError ? error.status : 500;
  const title =
    status === 404
      ? "Página no encontrada"
      : status === 403
        ? "Acceso no permitido"
        : status >= 500
          ? "No pudimos cargar la página"
          : "Algo salió mal";
  const details =
    routeError && typeof error.data === "string" && error.data.trim() !== ""
      ? error.data
      : status === 404
        ? "La página que buscas no existe."
        : "No pudimos completar la solicitud. Inténtalo de nuevo.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <section className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-full)] border border-danger/40 bg-danger/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Error {status}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-text">{title}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{details}</p>
        <Link
          className="focus-ring w-fit rounded-[var(--radius-sm)] text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
          to="/login"
        >
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  );
}
