import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorCode, ErrorDetail } from "@tucatalogo/types";
import { ERROR_CODES } from "@tucatalogo/types";

/** Error de dominio. El route lo mapea a status + envelope (PLAN §8.1). */
export class AppError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
    /**
     * Sub-código estable que viaja en `error.reason` (catálogo `AUTH_REASONS`).
     * Opcional: los errores sin causa accionable no lo llevan.
     */
    readonly reason?: string,
    /** Cabeceras extra de la respuesta de error (p. ej. `Retry-After`). */
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = ERROR_CODES[code] as ContentfulStatusCode;
  }
}
