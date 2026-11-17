import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorDetail } from "@tucatalogo/types";

import { AppError } from "../errors";
import type { AppEnv } from "../types";

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  const appError = error instanceof AppError ? error : null;

  if (!appError) {
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        message: error.message,
        stack: error.stack,
      }),
    );
  }

  const details: ErrorDetail[] | undefined = appError?.details;
  const reason = appError?.reason;
  const status: ContentfulStatusCode = appError?.status ?? 500;

  for (const [name, value] of Object.entries(appError?.headers ?? {})) {
    c.header(name, value);
  }

  return c.json(
    {
      error: {
        code: appError?.code ?? "INTERNAL",
        message: appError?.message ?? "Error interno. Inténtalo de nuevo.",
        ...(reason ? { reason } : {}),
        ...(details ? { details } : {}),
        requestId,
      },
    },
    status,
  );
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Recurso no encontrado.",
        requestId: c.get("requestId") ?? "unknown",
      },
    },
    404,
  );
