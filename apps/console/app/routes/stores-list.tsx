import { Button, buttonVariants, cn } from "@tucatalogo/ui";
import { data, Form, Link, useLoaderData } from "react-router";

import { Alert } from "../components/alert";
import { EmptyState } from "../components/empty-state";
import { SelectField, TextField } from "../components/field";
import { PageHeader } from "../components/page-header";
import { Pagination } from "../components/pagination";
import { ProtectedRouteError } from "../components/route-error";
import { StoreStatusBadge } from "../components/status-badge";
import { apiContext, getApi } from "../lib/api.server";
import { STATUS_FILTER_OPTIONS, readStoreFilters, storeListHref, totalPages } from "../lib/filters";
import { describeSuspendedBy, formatCount, formatDate } from "../lib/format";
import { consoleResponseHeaders } from "../lib/http.server";
import { requireConsoleSession } from "../lib/session.server";
import { listConsoleStores } from "@tucatalogo/api-client";
import type { Route } from "./+types/stores-list";

export async function loader({ request }: Route.LoaderArgs) {
  const api = getApi();
  const context = apiContext(request);
  const session = await requireConsoleSession(api, context);

  const url = new URL(request.url);
  const filters = readStoreFilters(url.searchParams);
  const list = await listConsoleStores(api, context, filters);

  return data(
    {
      list,
      filters,
      deletedSlug: (url.searchParams.get("eliminada") ?? "").trim().slice(0, 80) || null,
    },
    { headers: consoleResponseHeaders(session.setCookies) },
  );
}

export function meta() {
  return [{ title: "Tiendas · Console TuCatálogo" }];
}

export default function StoresList() {
  const { list, filters, deletedSlug } = useLoaderData<typeof loader>();
  const pages = totalPages(list.total, list.pageSize);
  const hasFilters = Boolean(filters.q || filters.status);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Tiendas"
        description={
          <>
            {formatCount(list.total)} {list.total === 1 ? "tienda" : "tiendas"} en total.
          </>
        }
        actions={
          <Link to="/auditoria" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Ver auditoría
          </Link>
        }
      />

      {deletedSlug ? (
        <Alert tone="success" title="Tienda eliminada">
          <p>
            <code className="font-mono">{deletedSlug}</code> se borró junto con sus datos. El
            identificador queda en cuarentena 90 días.
          </p>
        </Alert>
      ) : null}

      <Form
        key={`${filters.q ?? ""}|${filters.status ?? ""}`}
        method="get"
        role="search"
        className="grid gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-[var(--shadow-sm)] sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-end"
      >
        <TextField
          id="q"
          name="q"
          label="Buscar"
          defaultValue={filters.q ?? ""}
          placeholder="Slug, nombre o email del dueño"
          autoComplete="off"
          inputMode="search"
        />
        <SelectField
          id="status"
          name="status"
          label="Estado"
          defaultValue={filters.status ?? ""}
          options={[{ value: "", label: "Todas" }, ...STATUS_FILTER_OPTIONS]}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            Filtrar
          </Button>
          {hasFilters ? (
            <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Limpiar
            </Link>
          ) : null}
        </div>
      </Form>

      {list.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Ninguna tienda coincide" : "Todavía no hay tiendas"}
          description={
            hasFilters
              ? "Prueba con otro slug, nombre, email o estado."
              : "Cuando se registre una tienda aparecerá aquí con sus datos de contacto y estado."
          }
          action={
            hasFilters ? (
              <Link to="/" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                Quitar filtros
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop: tabla densa. La región es focusable para que el teclado
              pueda desplazarla cuando el ancho no llega a `min-w`. */}
          <div
            role="region"
            aria-label="Listado de tiendas"
            tabIndex={0}
            className="focus-ring hidden overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-sm)] md:block"
          >
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <caption className="sr-only">Tiendas del SaaS</caption>
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Tienda
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Dueño
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Creada
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Actualizada
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((store) => (
                  <tr
                    key={store.id}
                    className="border-t border-border align-top transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/tiendas/${store.id}`}
                        className="focus-ring rounded-[var(--radius-sm)] font-medium text-primary hover:underline"
                      >
                        {store.name}
                      </Link>
                      <div className="font-mono text-[11px] text-text-muted">{store.slug}</div>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-text-muted" title={store.ownerEmail}>
                      {store.ownerEmail}
                    </td>
                    <td className="px-3 py-2">
                      <StoreStatusBadge status={store.status} />
                      {store.suspendedBy ? (
                        <div className="mt-1 text-[11px] text-text-muted">
                          por {describeSuspendedBy(store.suspendedBy)}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                      {formatDate(store.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                      {formatDate(store.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/tiendas/${store.id}`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="grid gap-2 md:hidden">
            {list.items.map((store) => (
              <li key={store.id}>
                <Link
                  to={`/tiendas/${store.id}`}
                  className="focus-ring grid gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-[var(--shadow-sm)] transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{store.name}</p>
                      <p className="truncate font-mono text-[11px] text-text-muted">{store.slug}</p>
                    </div>
                    <StoreStatusBadge status={store.status} />
                  </div>
                  <p className="truncate text-xs text-text-muted">{store.ownerEmail}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                    <span>Creada: {formatDate(store.createdAt)}</span>
                    <span>Actualizada: {formatDate(store.updatedAt)}</span>
                  </div>
                  {store.suspendedBy ? (
                    <p className="text-[11px] text-text-muted">
                      Suspendida por {describeSuspendedBy(store.suspendedBy)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={list.page}
            totalPages={pages}
            buildHref={(page) => storeListHref(filters, page)}
            label="Paginación de tiendas"
          />
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ProtectedRouteError error={error} />;
}
