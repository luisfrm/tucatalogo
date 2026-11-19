import { PROD_HOSTS } from "@tucatalogo/shared/constants";
import {
  absoluteUrl,
  socialMetaDescriptors,
  type SocialImage,
  type SocialMetaDescriptor,
} from "@tucatalogo/shared/social-meta";

/**
 * Metadatos sociales del console (`console.tucatalogo.live`).
 *
 * El console es `noindex, nofollow`: las etiquetas OG existen solo para las
 * previsualizaciones internas (Slack, correo, chat), no para indexar. Como
 * React Router renderiza únicamente el `meta()` de la ruta más profunda, cada
 * página que define título debe volver a pedir el juego completo con
 * `consoleMeta()`; si no, perdería el `robots` del root.
 */
export const CONSOLE_ORIGIN = absoluteUrl(PROD_HOSTS.console);

export const CONSOLE_OG_IMAGE: SocialImage = {
  url: absoluteUrl(PROD_HOSTS.console, "/og.png"),
  width: 1200,
  height: 630,
  alt: "Console de TuCatálogo: acceso al backoffice de tiendas",
  type: "image/png",
};

export const CONSOLE_SITE_NAME = "TuCatálogo Console";

export const CONSOLE_DEFAULT_TITLE = "Console · TuCatálogo";

export const CONSOLE_DEFAULT_DESCRIPTION =
  "Backoffice de TuCatálogo: tiendas, suspensiones, borrado y auditoría. Acceso restringido al equipo.";

export const CONSOLE_ROBOTS = "noindex, nofollow";

export interface ConsoleMetaInput {
  title: string;
  description?: string;
  /** Ruta canónica dentro del console (`/login`, `/`…). */
  path?: string;
}

export function consoleMeta(
  input: ConsoleMetaInput,
): SocialMetaDescriptor[] {
  return socialMetaDescriptors({
    title: input.title,
    description: input.description ?? CONSOLE_DEFAULT_DESCRIPTION,
    url: absoluteUrl(PROD_HOSTS.console, input.path ?? "/"),
    siteName: CONSOLE_SITE_NAME,
    image: CONSOLE_OG_IMAGE,
    locale: "es_ES",
    type: "website",
    robots: CONSOLE_ROBOTS,
  });
}
