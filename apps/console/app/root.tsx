import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { renderAdminStyleTag } from "@tucatalogo/themes";

import type { Route } from "./+types/root";
import "./app.css";

/**
 * Tokens del console resueltos en servidor (PLAN §10.4/§10.5): paleta neutra,
 * densidad alta y tipografía de sistema. Se emite antes del primer pintado, sin
 * JS de cliente y sin FOUC.
 *
 * `renderAdminStyleTag` devuelve `<style>…</style>`; React no permite anidar esa
 * etiqueta dentro del `<head>`, así que se extrae su contenido y se inyecta en
 * un `<style>` propio. Si el formato cambiara, falla de forma visible.
 */
function consoleThemeCss(): string {
  const tag = renderAdminStyleTag({ surface: "console", mode: "light" });
  const open = tag.indexOf(">");
  const close = tag.lastIndexOf("</style>");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error("renderAdminStyleTag devolvió un formato inesperado.");
  }
  return tag.slice(open + 1, close);
}

const CONSOLE_THEME_CSS = consoleThemeCss();

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
        <Links />
        <style dangerouslySetInnerHTML={{ __html: CONSOLE_THEME_CSS }} />
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
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-text-muted">{details}</p>
      <Link className="text-sm font-medium text-primary underline underline-offset-4" to="/login">
        Volver al inicio de sesión
      </Link>
    </main>
  );
}
