import { checkStoreSlug } from "@tucatalogo/api-client";
import { slugCheckInputSchema } from "@tucatalogo/types";

import type { Route } from "./+types/registro.slug-check";

import { isApiErrorLike } from "~/features/signup/messages";
import { getApi } from "~/lib/api";

/**
 * Resource route same-origin para la comprobación en vivo del slug.
 *
 * El navegador nunca llama al API: este loader (servidor) usa el service
 * binding y devuelve el contrato de `GET /auth/store/slug-check`. Un fallo de
 * transporte se responde como 503 explícito (nunca un "disponible" falso).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const parsed = slugCheckInputSchema.safeParse({
    slug: url.searchParams.get("slug") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Escribe un identificador antes de comprobarlo.",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await checkStoreSlug(getApi(context), parsed.data.slug);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (isApiErrorLike(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.status >= 400 && error.status <= 599 ? error.status : 400,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    console.error(
      JSON.stringify({
        level: "error",
        app: "commercial",
        message: "No se pudo comprobar el slug",
        detail: error instanceof Error ? error.message : String(error),
      }),
    );

    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "No pudimos comprobar el identificador. Inténtalo de nuevo.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
