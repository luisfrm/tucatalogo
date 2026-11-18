/**
 * Hosts de producción (PLAN §4.2). Única fuente de verdad en código.
 *
 * Dominio propio `tucatalogo.live`: el **apex es el commercial** y las tiendas
 * viven en `{slug}.tucatalogo.live` (la única subzona con comodín). `console` y
 * `bucket` (R2) son hosts exactos dentro de esa misma zona.
 */
export const PROD_HOSTS = {
  commercial: "tucatalogo.live",
  console: "console.tucatalogo.live",
  /** Raíz de la subzona de tiendas: `{slug}.` + este valor = host de la tienda. */
  storefrontRoot: "tucatalogo.live",
  media: "bucket.tucatalogo.live",
} as const;

/** `www` redirige 301 al apex (commercial) con Redirect Rules: no es un worker. */
export const PROD_REDIRECT_HOSTS = ["www.tucatalogo.live"] as const;
