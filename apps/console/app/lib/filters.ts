import type { StoreStatus } from "@tucatalogo/types";

/**
 * Filtros del listado (PLAN §11.2).
 *
 * Módulo ligero: lo consumen también componentes de cliente, así que no importa
 * Zod ni el runtime de los schemas. La validación de formularios vive en
 * `validation.server.ts`.
 */

export const DEFAULT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 120;

/**
 * Catálogo local de estados. Se mantiene alineado con `STORE_STATUSES` de
 * `@tucatalogo/types` sin arrastrar su runtime (y con ello Zod) al navegador.
 */
const STORE_STATUS_VALUES = ["pending", "active", "suspended"] as const;

export interface StoreFilters {
  q?: string;
  status?: StoreStatus;
  page: number;
}

export function parsePage(raw: string | null | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseStatusFilter(raw: string | null | undefined): StoreStatus | undefined {
  const value = (raw ?? "").trim();
  return STORE_STATUS_VALUES.find((status) => status === value);
}

export function readStoreFilters(params: URLSearchParams): StoreFilters {
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const status = parseStatusFilter(params.get("status"));
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    page: parsePage(params.get("page")),
  };
}

/** Enlace del listado conservando búsqueda/filtro y cambiando de página. */
export function storeListHref(filters: StoreFilters, page = filters.page): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function totalPages(total: number, pageSize = DEFAULT_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export const STATUS_FILTER_OPTIONS = STORE_STATUS_VALUES.map((status) => ({
  value: status,
  label:
    status === "pending" ? "Pendientes" : status === "active" ? "Activas" : "Suspendidas",
}));
