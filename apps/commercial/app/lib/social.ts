import { PROD_HOSTS } from "@tucatalogo/shared/constants";
import {
  absoluteUrl,
  socialMetaDescriptors,
  type SocialImage,
  type SocialMetaDescriptor,
} from "@tucatalogo/shared/social-meta";

/**
 * Metadatos sociales de la landing (`tucatalogo.live`).
 *
 * Las URLs son **de producción y absolutas**, no del host de la petición: un
 * `og:image` relativo o con `localhost` no lo resuelve ningún rastreador y en
 * dev/preview sale mal. Ver `packages/shared/src/libs/social-meta.ts`.
 *
 * El juego de etiquetas debe ser completo en cada página porque React Router
 * renderiza solo el `meta()` de la ruta más profunda.
 */
export const COMMERCIAL_ORIGIN = absoluteUrl(PROD_HOSTS.commercial);

export const COMMERCIAL_OG_IMAGE: SocialImage = {
  url: absoluteUrl(PROD_HOSTS.commercial, "/og.png"),
  width: 1200,
  height: 630,
  alt: "TuCatálogo: tu catálogo online, listo para vender por WhatsApp",
  type: "image/png",
};

export const COMMERCIAL_SITE_NAME = "TuCatálogo";

export const COMMERCIAL_DEFAULT_TITLE =
  "TuCatálogo · Tu catálogo con pedidos por WhatsApp";

export const COMMERCIAL_DEFAULT_DESCRIPTION =
  "Crea el catálogo de tu tienda en minutos: enlace propio, cinco temas con versión clara y oscura, panel en español y pedidos directos a tu WhatsApp.";

export interface CommercialMetaInput {
  title: string;
  description: string;
  /** Ruta canónica dentro del apex (`/`, `/registro`, `/terminos`…). */
  path?: string;
  /** Páginas que no deben indexarse (el formulario de alta). */
  robots?: string;
}

export function commercialMeta(
  input: CommercialMetaInput,
): SocialMetaDescriptor[] {
  return socialMetaDescriptors({
    title: input.title,
    description: input.description,
    url: absoluteUrl(PROD_HOSTS.commercial, input.path ?? "/"),
    siteName: COMMERCIAL_SITE_NAME,
    image: COMMERCIAL_OG_IMAGE,
    locale: "es_ES",
    type: "website",
    robots: input.robots,
  });
}
