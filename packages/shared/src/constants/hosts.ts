/** Hosts de producción (PLAN §4.2). Única fuente de verdad en código. */
export const PROD_HOSTS = {
  commercial: "tucatalogo.luisrivas.site",
  console: "console-tucatalogo.luisrivas.site",
  storefrontRoot: "luisrivas.site",
  media: "tucatalogo-bucket.luisrivas.site",
} as const;

/** Apex y www redirigen 301 al commercial con Redirect Rules (no son workers). */
export const PROD_REDIRECT_HOSTS = ["luisrivas.site", "www.luisrivas.site"] as const;
