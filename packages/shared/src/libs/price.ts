import type { Currency } from "@tucatalogo/types";

/**
 * Los precios se guardan en unidad mínima entera (PLAN §6.5) con la moneda
 * de la tienda. No se convierte entre monedas.
 */
export const CURRENCY_MINOR_EXPONENT: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  COP: 2,
  VES: 2,
  ARS: 2,
};

export function minorUnitsToMajor(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCY_MINOR_EXPONENT[currency];
}

export function formatPriceMinor(
  amountMinor: number,
  currency: Currency,
  locale = "es",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCY_MINOR_EXPONENT[currency],
    maximumFractionDigits: CURRENCY_MINOR_EXPONENT[currency],
  }).format(minorUnitsToMajor(amountMinor, currency));
}
