import {
  listPanelCategories,
  listPanelHero,
  listPanelProducts,
} from "@tucatalogo/api-client";
import { isThemeImplemented } from "@tucatalogo/themes";
import { Button } from "@tucatalogo/ui";
import { Link } from "react-router";

import type { Route } from "./+types/dashboard";

import {
  PanelCard,
  PanelEmpty,
  PanelFlash,
  PanelPageHeader,
  PanelStat,
  StatusBadge,
} from "~/components/panel/panel-ui";
import { panelFlashMessage } from "~/lib/panel";
import { requirePanelContext } from "~/lib/panel.server";
import { throwApiFailure } from "~/lib/runtime.server";
import { homeHref, panelHref } from "~/lib/urls";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requirePanelContext(request);
  const apiContext = {
    storeSlug: context.slug,
    cookie: context.cookie,
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
  };

  const [allProducts, activeProducts, categories, hero] = await Promise.allSettled([
    listPanelProducts(context.runtime.api, apiContext, { status: "all", page: 1 }),
    listPanelProducts(context.runtime.api, apiContext, { status: "active", page: 1 }),
    listPanelCategories(context.runtime.api, apiContext),
    listPanelHero(context.runtime.api, apiContext),
  ]);

  if (allProducts.status === "rejected") {
    throwApiFailure(context.runtime, allProducts.reason, "panel.dashboard_products_failed");
  }
  if (activeProducts.status === "rejected") {
    throwApiFailure(context.runtime, activeProducts.reason, "panel.dashboard_active_failed");
  }
  if (categories.status === "rejected") {
    throwApiFailure(context.runtime, categories.reason, "panel.dashboard_categories_failed");
  }
  if (hero.status === "rejected") {
    throwApiFailure(context.runtime, hero.reason, "panel.dashboard_hero_failed");
  }

  const store = context.store;
  const totalProducts = allProducts.value.total;
  const activeCount = activeProducts.value.total;
  const categoryCount = categories.value.items.length;
  const slideCount = hero.value.items.length;
  const activeSlides = hero.value.items.filter((slide) => slide.isActive).length;

  return {
    store: {
      name: store.name,
      slug: store.slug,
      status: store.status,
      themeId: store.themeId,
      whatsappNumber: store.whatsappNumber,
    },
    siteId: context.siteId,
    counts: {
      totalProducts,
      activeProducts: activeCount,
      hiddenProducts: Math.max(0, totalProducts - activeCount),
      categories: categoryCount,
      slides: slideCount,
      activeSlides,
    },
    checklist: [
      {
        key: "product",
        label: "Publica tu primer producto",
        done: totalProducts > 0,
        href: panelHref("productos/nuevo", { siteId: context.siteId }),
        cta: totalProducts > 0 ? "Ver productos" : "Crear producto",
      },
      {
        key: "hero",
        label: "Añade un slide al hero",
        done: slideCount > 0,
        href: panelHref("hero", { siteId: context.siteId }),
        cta: slideCount > 0 ? "Editar hero" : "Crear slide",
      },
      {
        key: "whatsapp",
        label: "Configura el WhatsApp de pedidos",
        done: Boolean(store.whatsappNumber),
        href: panelHref("settings", { siteId: context.siteId }),
        cta: "Revisar WhatsApp",
      },
      {
        key: "theme",
        label: "Elige el tema de tu catálogo",
        done: isThemeImplemented(store.themeId),
        href: panelHref("settings", { siteId: context.siteId }),
        cta: "Elegir tema",
      },
    ],
    flash: panelFlashMessage(new URL(request.url).searchParams.get("ok")),
  };
}

export function meta({ matches }: Route.MetaArgs) {
  const data = matches.at(-1)?.loaderData as { store?: { name?: string } } | undefined;
  return [
    { title: `Resumen · ${data?.store?.name ?? "Panel"}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function PanelDashboard({ loaderData }: Route.ComponentProps) {
  const { counts, checklist, store, siteId, flash } = loaderData;

  return (
    <div className="flex flex-col gap-5">
      <PanelPageHeader
        eyebrow="Resumen"
        title={`Hola, ${store.name}`}
        description={
          <p>
            Estado de tu catálogo y los siguientes pasos para vender por WhatsApp.{" "}
            <StatusBadge
              tone={
                store.status === "active" ? "success" : store.status === "suspended" ? "danger" : "warning"
              }
            >
              {store.status === "active" ? "Publicada" : store.status === "suspended" ? "Suspendida" : "Pendiente"}
            </StatusBadge>
          </p>
        }
        actions={
          <>
            <Button asChild variant="secondary" size="md">
              <Link to={homeHref({ siteId })}>Ver tienda</Link>
            </Button>
            <Button asChild size="md">
              <Link to={panelHref("productos/nuevo", { siteId })}>Nuevo producto</Link>
            </Button>
          </>
        }
      />

      <PanelFlash message={flash} />

      <section aria-label="Conteos de la tienda" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelStat
          label="Productos"
          value={counts.totalProducts}
          hint={`${counts.activeProducts} visibles · ${counts.hiddenProducts} ocultos`}
        />
        <PanelStat label="Categorías" value={counts.categories} hint="Cada producto puede tener una" />
        <PanelStat
          label="Slides del hero"
          value={counts.slides}
          hint={`${counts.activeSlides} activos de 10`}
        />
        <PanelStat
          label="WhatsApp"
          value={store.whatsappNumber ? "Activo" : "Sin configurar"}
          hint={store.whatsappNumber ?? "Añádelo en Ajustes"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <PanelCard>
          <h2 className="font-heading text-base font-semibold">Primeros pasos</h2>
          <p className="mt-1 text-sm text-text-muted">
            Marca lo que ya está listo; cada punto lleva a la pantalla correspondiente.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {checklist.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={
                      item.done
                        ? "grid size-5 place-items-center rounded-full bg-success text-[10px] font-bold text-[var(--color-text-inverse)]"
                        : "grid size-5 place-items-center rounded-full border border-border-strong text-[10px] text-text-muted"
                    }
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span className={item.done ? "text-text-muted line-through" : ""}>{item.label}</span>
                  <span className="sr-only">{item.done ? "Completado" : "Pendiente"}</span>
                </span>
                <Link
                  to={item.href}
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {item.cta}
                </Link>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard>
          <h2 className="font-heading text-base font-semibold">Tu tienda</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Dirección</dt>
              <dd className="truncate font-mono text-xs">{store.slug}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Tema</dt>
              <dd className="font-mono text-xs">{store.themeId}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Estado</dt>
              <dd>{store.status}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to={panelHref("settings", { siteId })}>Ajustes de la tienda</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={panelHref("hero", { siteId })}>Editar el hero</Link>
            </Button>
          </div>
        </PanelCard>
      </div>

      {counts.totalProducts === 0 ? (
        <PanelEmpty
          title="Tu catálogo está vacío"
          description="Crea el primer producto para que aparezca en la tienda y se pueda pedir por WhatsApp."
          action={
            <Button asChild size="md">
              <Link to={panelHref("productos/nuevo", { siteId })}>Crear el primer producto</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
