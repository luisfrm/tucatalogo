/**
 * Validación Zod de entrada (PLAN §8.4): entrada inválida = 400 con `details`,
 * nunca 500. Los schemas viven en `@tucatalogo/types`.
 */
import type { Context } from "hono";
import type { z } from "zod";

import { AppError } from "../errors";

function toDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join(".") || "(root)",
    message: issue.message,
  }));
}

/** Parsea el JSON del body con un schema de Zod. */
export async function parseJsonBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<z.infer<S>> {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "El cuerpo de la petición no es JSON válido.");
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Revisa los datos del formulario.",
      toDetails(result.error),
    );
  }
  return result.data;
}

/** Parsea el query string con un schema de Zod. */
export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.infer<S> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Revisa los datos del formulario.",
      toDetails(result.error),
    );
  }
  return result.data;
}

/**
 * Parsea los parámetros de ruta (`:id`, `:slug`) con un schema de Zod.
 * Un id mal formado es 400 (entrada inválida), nunca 500.
 */
export function parseParams<S extends z.ZodType>(c: Context, schema: S): z.infer<S> {
  const result = schema.safeParse(c.req.param());
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Revisa los datos del formulario.",
      toDetails(result.error),
    );
  }
  return result.data;
}
