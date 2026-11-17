/**
 * Dinero del catálogo: precios en unidad mínima entera con la moneda de la
 * tienda (PLAN §6.7 / AGENTS §14). No hay conversión entre monedas.
 */
import type { Currency } from "@tucatalogo/types";
import { formatPriceMinor } from "@tucatalogo/shared";

/** Etiqueta legible del precio para el mensaje de WhatsApp. */
export function priceLabel(amountMinor: number, currency: Currency): string {
  return formatPriceMinor(amountMinor, currency);
}

/** Guarda de escritura: entero, ≥ 0 y dentro del rango del contrato. */
export function isValidPriceMinor(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100_000_000;
}
