import { CURRENCY_MINOR_EXPONENT } from "@tucatalogo/shared";
import type { Currency } from "@tucatalogo/types";

/**
 * Helpers puros del panel del dueño (F5).
 *
 * Aquí no hay acceso a red ni a DOM: precios, slugs, plantilla de WhatsApp,
 * paginación, flashes y reordenamiento se prueban en Vitest sin servidor.
 */

/** El API fija 20 por página en `/panel/products` (apps/api/src/routes/README.md). */
export const PANEL_PAGE_SIZE = 20;

/** Topes del contrato de media. */
export const PRODUCT_IMAGE_LIMIT = 8;
export const HERO_SLIDE_LIMIT = 10;

/** Tope de entrada por archivo, ya normalizado en el navegador. */
export const IMAGE_INPUT_MAX_BYTES = 2 * 1024 * 1024;

export type PriceParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export const PRICE_ERROR_MESSAGE = "Escribe un precio válido (máximo 2 decimales).";

/**
 * Convierte lo que el dueño escribe (`12,99`, `12.99`, `1.234,56`) a unidad
 * mínima entera en la moneda de la tienda. No convierte moneda ni inventa
 * redondeos: una entrada ambigua o con más decimales de los permitidos falla.
 */
export function parsePriceToMinor(input: string, currency: Currency): PriceParseResult {
  const exponent = CURRENCY_MINOR_EXPONENT[currency];
  const raw = input.replace(/[\s\u00a0]/g, "").trim();

  if (raw.length === 0) return { ok: false, error: "Escribe el precio." };
  if (!/^\d[\d.,]*$/.test(raw)) return { ok: false, error: PRICE_ERROR_MESSAGE };

  const commas = (raw.match(/,/g) ?? []).length;
  const dots = (raw.match(/\./g) ?? []).length;

  let integerPart = raw;
  let fractionPart = "";

  if (commas > 0 && dots > 0) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    if (raw.split(decimalSeparator).length > 2) {
      return { ok: false, error: PRICE_ERROR_MESSAGE };
    }
    const [head, tail = ""] = raw.split(decimalSeparator);
    if (head.includes(groupingSeparator) || tail.includes(groupingSeparator)) {
      const groups = head.split(groupingSeparator);
      if (groups.length > 1 && groups.slice(1).some((group) => group.length !== 3)) {
        return { ok: false, error: PRICE_ERROR_MESSAGE };
      }
      integerPart = groups.join("");
      fractionPart = tail;
    } else {
      integerPart = head;
      fractionPart = tail;
    }
  } else if (commas > 0 || dots > 0) {
    const separator = commas > 0 ? "," : ".";
    const pieces = raw.split(separator);
    const tail = pieces.at(-1) ?? "";

    if (pieces.length > 2) {
      // Separador repetido: solo es agrupación si cada grupo tiene 3 dígitos.
      if (pieces.slice(1).some((group) => group.length !== 3)) {
        return { ok: false, error: PRICE_ERROR_MESSAGE };
      }
      integerPart = pieces.join("");
      fractionPart = "";
    } else if (tail.length === 0) {
      integerPart = pieces[0] ?? "";
      fractionPart = "";
    } else if (tail.length <= exponent) {
      integerPart = pieces[0] ?? "";
      fractionPart = tail;
    } else if (tail.length === 3) {
      // `1.234` en español se lee como mil doscientos treinta y cuatro.
      integerPart = pieces.join("");
      fractionPart = "";
    } else {
      return { ok: false, error: PRICE_ERROR_MESSAGE };
    }
  }

  if (integerPart.length === 0) integerPart = "0";
  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(fractionPart)) {
    return { ok: false, error: PRICE_ERROR_MESSAGE };
  }
  if (fractionPart.length > exponent) {
    return { ok: false, error: PRICE_ERROR_MESSAGE };
  }

  const padded = fractionPart.padEnd(exponent, "0");
  const value =
    Number.parseInt(integerPart, 10) * 10 ** exponent +
    (padded.length > 0 ? Number.parseInt(padded, 10) : 0);

  if (!Number.isSafeInteger(value)) return { ok: false, error: PRICE_ERROR_MESSAGE };
  if (value < 0 || value > 100_000_000) {
    return { ok: false, error: "El precio supera el máximo permitido." };
  }

  return { ok: true, value };
}

/** Valor para un `<input inputMode="decimal">` a partir de la unidad mínima. */
export function formatMinorForInput(amountMinor: number, currency: Currency): string {
  const exponent = CURRENCY_MINOR_EXPONENT[currency];
  return (amountMinor / 10 ** exponent).toFixed(exponent);
}

/**
 * Slug de producto/categoría a partir del nombre. Se puede editar a mano en el
 * formulario; el API sigue siendo la autoridad final de formato/unicidad.
 */
export function slugifyCatalogName(input: string, maxLength = 63): string {
  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug;
}

export interface WhatsappPreviewInput {
  number: string;
  template: string;
  productName: string;
  priceLabel: string;
  storeName: string;
}

export const WHATSAPP_PLACEHOLDERS = ["{producto}", "{precio}", "{tienda}"] as const;

/**
 * Preview de la plantilla de WhatsApp. Se calcula en servidor y en el cliente
 * con la misma función; el API es quien construye la URL real del storefront.
 */
export function buildWhatsappPreview(input: WhatsappPreviewInput): string | null {
  const number = input.number.trim();
  if (!/^\d{8,15}$/.test(number)) return null;

  const text = input.template
    .replaceAll("{producto}", input.productName)
    .replaceAll("{precio}", input.priceLabel)
    .replaceAll("{tienda}", input.storeName)
    .trim();

  if (text.length === 0) return `https://wa.me/${number}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Aviso visible en el panel cuando la plantilla no trae variables. */
export function whatsappTemplateUsesPlaceholders(template: string): boolean {
  return WHATSAPP_PLACEHOLDERS.some((placeholder) => template.includes(placeholder));
}

export interface PanelProductsQuery {
  q: string;
  category: string;
  status: "all" | "active" | "inactive";
  page: number;
}

/** Lee `?q=&category=&status=&page=` sin confiar en el navegador. */
export function readPanelProductsQuery(url: URL): PanelProductsQuery {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const category = (url.searchParams.get("category") ?? "").trim().slice(0, 64);
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 10_000) : 1;

  return { q, category, status, page };
}

/** Mueve un id una posición arriba/abajo. Devuelve `null` si no puede moverse. */
export function moveItem(
  ids: readonly string[],
  id: string,
  direction: "up" | "down",
): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;

  const next = [...ids];
  const [item] = next.splice(index, 1);
  if (item === undefined) return null;
  next.splice(target, 0, item);
  return next;
}

/** Mensajes de éxito que viajan en `?ok=` tras un POST/redirect/GET. */
const PANEL_FLASH_MESSAGES: Record<string, string> = {
  "store-saved": "Datos de la tienda guardados.",
  "logo-updated": "Logo actualizado.",
  "store-suspended": "La tienda quedó suspendida. El catálogo público muestra 404.",
  "store-reactivated": "La tienda volvió a estar activa.",
  "product-created": "Producto creado. Ahora puedes añadir imágenes.",
  "product-updated": "Producto actualizado.",
  "product-deleted": "Producto eliminado del catálogo.",
  "product-status": "Visibilidad del producto actualizada.",
  "product-reordered": "Orden de productos actualizado.",
  "image-uploaded": "Imagen añadida.",
  "image-deleted": "Imagen eliminada.",
  "image-updated": "Texto alternativo actualizado.",
  "images-reordered": "Orden de imágenes actualizado.",
  "category-created": "Categoría creada.",
  "category-updated": "Categoría actualizada.",
  "category-deleted": "Categoría eliminada. Sus productos quedaron sin categoría.",
  "hero-created": "Slide añadido al hero.",
  "hero-updated": "Slide actualizado.",
  "hero-deleted": "Slide eliminado.",
  "hero-reordered": "Orden del hero actualizado.",
  "hero-images-updated": "Imágenes del slide reemplazadas.",
  "password-reset": "Contraseña actualizada. Inicia sesión con la nueva.",
};

export function panelFlashMessage(code: string | null): string | null {
  if (!code) return null;
  return PANEL_FLASH_MESSAGES[code] ?? null;
}

/**
 * Token del enlace de reset. Solo se lee del query, no se guarda ni se registra;
 * el formulario lo reenvía en un campo oculto de un solo uso.
 */
export function readResetToken(url: URL): string | null {
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (token.length === 0 || token.length > 512) return null;
  return token;
}

/** Solo rutas internas del panel: nunca `//host`, esquemas ni saltos de línea. */
export function safePanelRedirect(value: unknown, fallback = "/panel-admin"): string {
  if (typeof value !== "string") return fallback;
  const target = value.trim();
  if (!target.startsWith("/panel-admin")) return fallback;
  if (target.startsWith("//")) return fallback;
  if (target.includes("\\") || target.includes("\n") || target.includes("\r")) return fallback;
  if (target.split("/").includes("..")) return fallback;
  return target;
}

/** Suma `?ok=` conservando todos los filtros de la URL actual. */
export function withFlash(url: URL, code: string): string {
  const next = new URL(url.toString());
  next.searchParams.set("ok", code);
  return `${next.pathname}${next.search}`;
}

/** Etiqueta de estado del producto/categoría/slide para la UI. */
export function productStatusLabel(isActive: boolean): string {
  return isActive ? "Visible" : "Oculto";
}

/** Respuesta uniforme de las actions del panel para `useActionData`/`useFetcher`. */
export interface PanelActionData {
  ok?: boolean;
  intent?: string;
  message?: string;
  formError?: string;
  fieldErrors?: Record<string, string>;
}
