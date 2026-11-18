import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

import { joinStyleTags, styleTagContent } from "~/lib/style-tag";

/**
 * Tokens de la superficie `commercial` y de los 5 temas (para las previews del
 * registro y de la landing). Se calculan con `packages/themes` en el servidor:
 * el import dinámico deja el paquete fuera del bundle del navegador.
 *
 * Se emiten en el `<head>` antes del primer pintado (PLAN §10.5), sin FOUC.
 *
 * Sin fallback silencioso (§12): si los tokens no se pueden resolver, esto es
 * un 500 con log, nunca una landing pintada con los neutros de `@theme`.
 */
export async function loader() {
  try {
    const themes = await import("@tucatalogo/themes");
    const themeMetadata = themes.listThemeMetadata();

    return {
      surfaceCss: styleTagContent(
        themes.renderAdminStyleTag({
          surface: "commercial",
          extraVars: themes.commercialExtraVars("light"),
        }),
      ),
      // Identidad tipográfica compartida con console: Fraunces + Figtree,
      // self-hosted en `public/fonts` y con sustituciones `size-adjust`.
      fontFaceCss: themes.renderBrandFontFaceCss(),
      fontPreloadHrefs: themes.fontPreloadHrefs(),
      themePreviewCss: joinStyleTags(
        themeMetadata.map((theme) =>
          themes.renderThemeStyleTagFor({
            themeId: theme.id,
            mode: "light",
            primaryColor: theme.defaultPrimaryColor,
          }),
        ),
      ),
      themeMetadata,
    };
  } catch (error) {
    console.error(
      "[commercial] no se pudieron resolver los tokens de la superficie",
      error,
    );
    throw new Response("No pudimos preparar el sistema visual de la página.", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <html lang="es" data-surface="commercial" data-color-mode="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        {/* Antes del CSS: el navegador descubre las fuentes del primer viewport. */}
        {data
          ? data.fontPreloadHrefs.map((href) => (
              <link
                key={href}
                rel="preload"
                href={href}
                as="font"
                type="font/woff2"
                crossOrigin="anonymous"
              />
            ))
          : null}
        <Links />
        {data ? (
          <>
            <style
              data-fonts="self-hosted"
              dangerouslySetInnerHTML={{ __html: data.fontFaceCss }}
            />
            <style
              data-surface-tokens="commercial"
              dangerouslySetInnerHTML={{ __html: data.surfaceCss }}
            />
            <style
              data-theme-preview="true"
              dangerouslySetInnerHTML={{ __html: data.themePreviewCss }}
            />
          </>
        ) : null}
      </head>
      <body className="min-h-dvh bg-bg font-body text-text antialiased">
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
  let title = "Algo salió mal";
  let details = "No pudimos completar la solicitud. Inténtalo de nuevo.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Página no encontrada";
      details = "La página que buscas no existe.";
    } else if (error.status === 503) {
      title = "No disponible ahora mismo";
      details = "Estamos con una incidencia. Inténtalo de nuevo en unos minutos.";
    } else if (error.status >= 500) {
      // Los tokens del sistema visual son obligatorios: si fallan, se dice.
      title = "No pudimos cargar la página";
      details =
        "Hubo un problema al preparar el diseño de esta página. Inténtalo de nuevo en unos minutos.";
    } else {
      title = `Error ${error.status}`;
      details = error.statusText || details;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-6">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-text-muted">{details}</p>
      <a className="text-primary underline" href="/">
        Volver al inicio
      </a>
    </main>
  );
}
