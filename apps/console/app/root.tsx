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

export function meta() {
  return [
    { title: "Console · TuCatálogo" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-surface="console" data-color-mode="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
        Error {status}
      </p>
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-text-muted">{details}</p>
      <Link className="text-sm font-medium text-primary underline underline-offset-4" to="/login">
        Volver al inicio de sesión
      </Link>
    </main>
  );
}
