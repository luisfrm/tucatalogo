import { CURRENCY_MINOR_EXPONENT, formatPriceMinor } from "@tucatalogo/shared";
import type { Currency } from "@tucatalogo/types";

/**
 * Precio en la moneda de la tienda (PLAN §6.5 / §14).
 *
 * Solo se importa desde loaders: el precio ya formateado viaja al navegador en
 * los datos de la ruta. Así el cliente no arrastra `@tucatalogo/types` (Zod) y
 * el HTML no depende de JS para mostrar el precio.
 */
export function formatStorePrice(amountMinor: number, currency: Currency): string {
  return formatPriceMinor(amountMinor, currency, "es");
}

/** Precio decimal para datos estructurados (`schema.org`). */
export function priceDecimal(amountMinor: number, currency: Currency): string {
  const exponent = CURRENCY_MINOR_EXPONENT[currency];
  return (amountMinor / 10 ** exponent).toFixed(exponent);
}
