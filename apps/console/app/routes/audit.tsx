import { listConsoleAudit } from "@tucatalogo/api-client";
import { Button, buttonVariants } from "@tucatalogo/ui";
import { data, Form, Link, useLoaderData } from "react-router";

import { EmptyState } from "../components/empty-state";
import { TextField } from "../components/field";
import { Pagination } from "../components/pagination";
import { ProtectedRouteError } from "../components/route-error";
import { CodeBadge } from "../components/status-badge";
import { apiContext, getApi } from "../lib/api.server";
import {
  AUDIT_ACTION_SUGGESTIONS,
  formatAuditAction,
  formatAuditActorType,
  formatAuditTarget,
  summarizeMetadata,
} from "../lib/audit";
import { parsePage, totalPages } from "../lib/filters";
import { formatCount, formatTime, groupByDay } from "../lib/format";
import { consoleResponseHeaders } from "../lib/http.server";
import { requireConsoleSession } from "../lib/session.server";
import type { Route } from "./+types/audit";

interface AuditFilters {
  storeId?: string;
  action?: string;
  page: number;
}

function readAuditFilters(params: URLSearchParams): AuditFilters {
  const storeId = (params.get("storeId") ?? "").trim();
  const action = (params.get("action") ?? "").trim().slice(0, 60);
  return {
    ...(storeId ? { storeId } : {}),
    ...(action ? { action } : {}),
    page: parsePage(params.get("page")),
  };
}

function auditHref(filters: AuditFilters, page = filters.page): string {
  const params = new URLSearchParams();
  if (filters.storeId) params.set("storeId", filters.storeId);
  if (filters.action) params.set("action", filters.action);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/auditoria?${query}` : "/auditoria";
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = getApi();
  const context = apiContext(request);
  const session = await requireConsoleSession(api, context);

  const url = new URL(request.url);
  const filters = readAuditFilters(url.searchParams);
  const list = await listConsoleAudit(api, context, filters);

  return data(
    { list, filters },
    { headers: consoleResponseHeaders(session.setCookies) },
  );
}

export function meta() {
  return [{ title: "Auditoría · Console TuCatálogo" }];
}

export default function AuditLog() {
  const { list, filters } = useLoaderData<typeof loader>();
  const pages = totalPages(list.total, list.pageSize);
  const hasFilters = Boolean(filters.storeId || filters.action);
  const groups = groupByDay(list.items, (entry) => entry.createdAt);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Console
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Auditoría</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {formatCount(list.total)} {list.total === 1 ? "movimiento" : "movimientos"} · solo
            lectura.
          </p>
        </div>
        <Link to="/" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Volver a tiendas
        </Link>
      </header>

      <Form
        key={`${filters.storeId ?? ""}|${filters.action ?? ""}`}
        method="get"
        role="search"
        className="grid gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <TextField
          id="storeId"
          name="storeId"
          label="Tienda"
          defaultValue={filters.storeId ?? ""}
          placeholder="ID de la tienda"
          autoComplete="off"
          spellCheck={false}
          hint="Se obtiene desde la ficha de la tienda."
        />
        <TextField
          id="action"
          name="action"
          label="Acción"
          defaultValue={filters.action ?? ""}
          placeholder="store.suspend"
          autoComplete="off"
          spellCheck={false}
          list="audit-action-options"
          hint="Código exacto o cualquiera de la lista."
        />
        <datalist id="audit-action-options">
          {AUDIT_ACTION_SUGGESTIONS.map((action) => (
            <option key={action} value={action} />
          ))}
        </datalist>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            Filtrar
          </Button>
          {hasFilters ? (
            <Link to="/auditoria" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Limpiar
            </Link>
          ) : null}
        </div>
      </Form>

      {list.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Sin movimientos para este filtro" : "Todavía no hay movimientos"}
          description={
            hasFilters
              ? "Prueba con otro ID de tienda o con otra acción."
              : "Las altas, suspensiones, reactivaciones y borrados aparecerán aquí."
          }
          action={
            hasFilters ? (
              <Link
                to="/auditoria"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Quitar filtros
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid gap-4">
            {groups.map((group) => (
              <section key={group.key} className="grid gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {group.label}
                </h2>

                {/* Desktop */}
                <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface md:block">
                  <table className="w-full min-w-[820px] border-collapse text-[13px]">
                    <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-text-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Hora (UTC)</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Acción</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Tienda</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Actor</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Objetivo</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((entry) => (
                        <tr key={entry.id} className="border-t border-border align-top">
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-text-muted">
                            {formatTime(entry.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{formatAuditAction(entry.action)}</div>
                            <CodeBadge>{entry.action}</CodeBadge>
                          </td>
                          <td className="px-3 py-2">
                            {entry.storeId && entry.action !== "store.delete" ? (
                              <Link
                                to={`/tiendas/${entry.storeId}`}
                                className="font-mono text-xs text-primary hover:underline"
                              >
                                {formatAuditTarget(entry)}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs text-text-muted">
                                {formatAuditTarget(entry)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div>{formatAuditActorType(entry.actorType)}</div>
                            {entry.actorId ? (
                              <div className="max-w-[140px] truncate font-mono text-[11px] text-text-muted">
                                {entry.actorId}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-text-muted">
                            {entry.targetType ?? "—"}
                            {entry.targetId ? (
                              <div className="max-w-[160px] truncate font-mono text-[11px]">
                                {entry.targetId}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                            {summarizeMetadata(entry.metadata)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Móvil */}
                <ul className="grid gap-2 md:hidden">
                  {group.items.map((entry) => (
                    <li
                      key={entry.id}
                      className="grid gap-1 rounded-[var(--radius-md)] border border-border bg-surface p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{formatAuditAction(entry.action)}</p>
                          <CodeBadge>{entry.action}</CodeBadge>
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums text-text-muted">
                          {formatTime(entry.createdAt)} UTC
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        Tienda:{" "}
                        {entry.storeId && entry.action !== "store.delete" ? (
                          <Link
                            to={`/tiendas/${entry.storeId}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {formatAuditTarget(entry)}
                          </Link>
                        ) : (
                          <span className="font-mono">{formatAuditTarget(entry)}</span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatAuditActorType(entry.actorType)}
                        {entry.actorId ? (
                          <span className="ml-1 font-mono text-[11px]">
                            {entry.actorId.slice(0, 12)}…
                          </span>
                        ) : null}
                      </p>
                      <p className="break-all font-mono text-[11px] text-text-muted">
                        {summarizeMetadata(entry.metadata)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <Pagination
            page={list.page}
            totalPages={pages}
            buildHref={(page) => auditHref(filters, page)}
            label="Paginación de auditoría"
          />
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ProtectedRouteError error={error} />;
}
