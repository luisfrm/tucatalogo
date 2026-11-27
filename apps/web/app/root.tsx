import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { listPublicCategories } from "@tucatalogo/api-client";
import type { PublicCategory } from "@tucatalogo/types";

import type { Route } from "./+types/root";
import "./app.css";

import { NavigationProgress } from "~/components/navigation-progress";
import { StorefrontShell } from "~/components/storefront-shell";
import { resolveColorMode, resolvePanelColorMode } from "~/lib/color-mode";
import {
  createRequestRuntime,
  fail,
  fetchPanelStoreForRoot,
  fetchPublicStoreOrNull,
  healthRootData,
  notFound,
  resolveStoreRequest,
} from "~/lib/runtime.server";
import type { RootData } from "~/lib/store-context";
import { buildAdminThemeCss, buildStorefrontThemeHead } from "~/lib/theme-head";
import { homeHref, storefrontOrigin } from "~/lib/urls";

/**
 * Root del worker `web` (PLAN §4.5 D / §10.5).
 *
 * El loader resuelve tienda, tema y modo **en el servidor**: el `<head>` sale
 * con las CSS vars y el modo correcto antes del primer pintado. Nunca hay tema
 * por defecto: tema o color corrupto en D1 → 500 + log.
 *
 * `/health` no resuelve tienda (smoke del worker, §13.6).
 */
export async function loader({ request }: Route.LoaderArgs): Promise<RootData> {
  const url = new URL(request.url);
  if (url.pathname === "/health") {
    return healthRootData(request);
  }

  const runtime = createRequestRuntime(request);
  const { slug, siteId, surface } = resolveStoreRequest(request, runtime);
  const store = await fetchPublicStoreOrNull(runtime, slug);

  // Storefront: inexistente, suspendida o eliminada → 404 idéntico, sin motivo.
  if (surface === "storefront" && !store) {
    throw notFound();
  }

  /*
   * `/panel-admin` debe seguir vivo cuando la tienda pública responde 404
   * (suspendida, o recién eliminada). En ese caso el acento se resuelve con la
   * sesión del dueño + `getPanelStore`. Sin sesión se usa la base neutra
   * explícita del surface admin (`PANEL_BASE_ACCENT`), nunca un tema de tienda.
   */
  const panelStore =
    surface === "panel-admin" && !store
      ? await fetchPanelStoreForRoot(
          runtime,
          slug,
          request.headers.get("cookie") ?? undefined,
        )
      : null;

  const mode =
    surface === "panel-admin"
      ? resolvePanelColorMode({
          cookieHeader: request.headers.get("cookie"),
          storeDefault: store?.colorModeDefault ?? panelStore?.colorModeDefault ?? null,
        })
      : resolveColorMode({
          cookieHeader: request.headers.get("cookie"),
          storeDefault: store?.colorModeDefault ?? "light",
        });

  let theme: RootData["theme"] = null;
  let adminCss: string | null = null;
  let categories: PublicCategory[] = [];

  if (store && surface === "storefront") {
    try {
      const catResult = await listPublicCategories(runtime.api, slug);
      categories = catResult.items;
    } catch {
      categories = [];
    }

    try {
      theme = buildStorefrontThemeHead({
        themeId: store.themeId,
        primaryColor: store.primaryColor,
        mode,
      });
    } catch (error) {
      // Tema o color inválido en D1: 500 + log, nunca un tema por defecto.
      fail(runtime.requestId, 500, "El tema de la tienda no está disponible.", "theme.invalid_store_theme", {
        themeId: store.themeId,
        primaryColor: store.primaryColor,
        mode,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (surface === "panel-admin") {
    try {
      // Acento real de la tienda si se conoce; base neutra del panel si no.
      adminCss = buildAdminThemeCss({
        primaryColor: store?.primaryColor ?? panelStore?.primaryColor ?? null,
        mode,
      });
    } catch (error) {
      fail(runtime.requestId, 500, "El color de la tienda no está disponible.", "theme.invalid_store_color", {
        primaryColor: store?.primaryColor ?? panelStore?.primaryColor ?? null,
        mode,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    requestId: runtime.requestId,
    environment: runtime.environment,
    noindex: runtime.noindex,
    surface,
    siteId,
    store: store
      ? {
          slug: store.slug,
          name: store.name,
          logoUrl: store.logoUrl,
          currency: store.currency,
          hasWhatsapp: Boolean(store.whatsappNumber),
        }
      : null,
    categories,
    mode,
    theme,
    adminCss,
    canonicalBase: storefrontOrigin({
      request,
      environment: runtime.environment,
      slug,
      appDomain: runtime.appDomain,
    }),
  };
}

export function meta(_: Route.MetaArgs) {
  // Solo se usa cuando la ruta hoja no define su propio `meta` (health, panel).
  // Un 404/500 tampoco debe indexarse.
  return [
    { title: "TuCatálogo" },
    { name: "description", content: "Catálogo de la tienda." },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export function headers(_: Route.HeadersArgs) {
  // El HTML depende de la cookie de modo: nunca caché compartida.
  return { "cache-control": "private, no-store" };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<RootData>("root");
  const surface = data?.surface ?? "storefront";
  const mode = data?.mode ?? "light";
  const theme = data?.theme ?? null;

  return (
    <html
      lang="es"
      data-color-mode={mode}
      data-theme={surface === "storefront" ? theme?.themeId : undefined}
      data-surface={surface === "panel-admin" ? "panel-admin" : undefined}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
        {/*
          Después del CSS de Tailwind: los tokens del tema usan la misma
          especificidad que `:root` y deben ganar. Todo se resuelve en servidor,
          así que no hay parpadeo (PLAN §10.5).
        */}
        {theme ? (
          <>
            <style data-fonts="self-hosted" dangerouslySetInnerHTML={{ __html: theme.fontFaceCss }} />
            <style data-theme-tokens dangerouslySetInnerHTML={{ __html: theme.css }} />
            {theme.preloadHrefs.map((href) => (
              <link
                key={href}
                rel="preload"
                href={href}
                as="font"
                type="font/woff2"
                crossOrigin="anonymous"
              />
            ))}
          </>
        ) : null}
        {surface === "panel-admin" && data?.adminCss ? (
          <style data-admin-tokens dangerouslySetInnerHTML={{ __html: data.adminCss }} />
        ) : null}
      </head>
      <body className="min-h-screen bg-bg font-body text-text antialiased">
        <NavigationProgress />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootData>("root");

  if (!data?.store || data.surface === "panel-admin") {
    return <Outlet />;
  }

  return (
    <StorefrontShell
      store={data.store}
      categories={data.categories}
      mode={data.mode}
      siteId={data.siteId}
    >
      <Outlet />
    </StorefrontShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const data = useRouteLoaderData<RootData>("root");

  let status = 500;
  let title = "Algo salió mal";
  let message = "No pudimos completar la solicitud. Inténtalo de nuevo.";
  let requestId: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    const payload = error.data as { message?: unknown; requestId?: unknown } | undefined;
    const detail = typeof payload?.message === "string" ? payload.message : undefined;
    if (typeof payload?.requestId === "string") requestId = payload.requestId;

    if (status === 404) {
      title = "Página no encontrada";
      message = detail ?? "La página que buscas no existe.";
    } else {
      title = status >= 500 ? "El catálogo no está disponible" : "No pudimos completar la solicitud";
      message = detail ?? message;
    }
  } else if (error instanceof Error && import.meta.env.DEV) {
    message = error.message;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center gap-3 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-text-muted">{status}</p>
      <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{title}</h1>
      <p className="text-text-muted">{message}</p>
      {requestId ? (
        <p className="text-xs text-text-muted">
          Referencia: <code className="font-mono">{requestId}</code>
        </p>
      ) : null}
      {data?.store ? (
        <a
          className="mt-2 text-sm font-medium text-primary underline underline-offset-4"
          href={homeHref({ siteId: data.siteId })}
        >
          Volver al inicio
        </a>
      ) : null}
    </main>
  );
}
