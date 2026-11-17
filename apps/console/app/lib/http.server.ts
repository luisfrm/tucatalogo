import { copyApiSetCookies } from "@tucatalogo/api-client";

/**
 * Cabeceras de toda respuesta del console.
 *
 * - `no-store`: el console muestra datos de tenants y secretos de 2FA una sola
 *   vez; no debe quedar en caché.
 * - `noindex`: el backoffice no se indexa.
 * - Las cookies del API se copian **tal cual** (host-only, prefijo `console`),
 *   sin reescribir host ni `Domain` (PLAN §7.2).
 */
export function consoleResponseHeaders(setCookies: readonly string[] = []): Headers {
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");

  if (setCookies.length > 0) {
    const source = new Headers();
    for (const cookie of setCookies) source.append("set-cookie", cookie);
    copyApiSetCookies({ headers: source }, headers);
  }

  return headers;
}

/**
 * M1: el login normal solo puede dejar la cookie de challenge
 * `console.two_factor` (10 min). Cualquier cookie de sesión que llegara de
 * `/login` se descarta: la sesión se emite únicamente en `/2fa/verify`.
 *
 * Acepta los dos nombres posibles (`console.two_factor` en local,
 * `__Secure-console.two_factor` fuera de local) sin reescribirlos.
 */
export function consoleChallengeCookies(setCookies: readonly string[]): string[] {
  return setCookies.filter((cookie) => {
    const name = (cookie.split("=", 1)[0] ?? "").trim();
    return name === "console.two_factor" || name === "__Secure-console.two_factor";
  });
}
