/**
 * Lectura de la IP del cliente.
 *
 * El API no tiene ruta pública: la petición llega por service binding (o por
 * `127.0.0.1` en local). Por eso la IP se toma de la cabecera interna que fija
 * el worker frontal y, solo si no viene, de las cabeceras de Cloudflare.
 * El valor se usa para rate limiting y se guarda **hasheado**.
 */
import { AUTH_HEADERS } from "../constants/auth";

/** Valor de reserva cuando no hay IP conocida (nunca se escribe en D1). */
export const UNKNOWN_IP = "unknown";

function firstValue(value: string | null | undefined): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first ? first : undefined;
}

export function getClientIp(headers: Headers): string {
  return (
    firstValue(headers.get(AUTH_HEADERS.clientIp)) ??
    firstValue(headers.get("cf-connecting-ip")) ??
    firstValue(headers.get("x-forwarded-for")) ??
    UNKNOWN_IP
  );
}
