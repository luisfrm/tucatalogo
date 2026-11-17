/**
 * Hosts de producción (PLAN §4.2). Única fuente de verdad en código.
 *
 * Las tiendas viven en la **subzona dedicada** `tucatalogo.luisrivas.site`
 * (`{slug}.tucatalogo.luisrivas.site`). El dominio padre `luisrivas.site` **no**
 * tiene comodín: `commercial`, `console` y el bucket de R2 son hosts exactos y
 * ningún otro proyecto de la zona se ve afectado.
 */
export const PROD_HOSTS = {
  commercial: "tucatalogo.luisrivas.site",
  console: "console-tucatalogo.luisrivas.site",
  /** Raíz de la subzona: `{slug}.` + este valor. El padre no resuelve tiendas. */
  storefrontRoot: "tucatalogo.luisrivas.site",
  media: "tucatalogo-bucket.luisrivas.site",
} as const;

/** Apex y www redirigen 301 al commercial con Redirect Rules (no son workers). */
export const PROD_REDIRECT_HOSTS = ["luisrivas.site", "www.luisrivas.site"] as const;
