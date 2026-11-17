import { z } from "zod";

/**
 * Código de error estable del API. El status HTTP es parte del contrato
 * (PLAN §8.3): un cambio aquí es un cambio de contrato.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  /**
   * Fallo del almacenamiento de media (R2) en una operación que debía abortar
   * antes de tocar D1 (PLAN §12: subida fallida o borrado de tienda).
   */
  STORAGE_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const errorCodeSchema = z.enum(
  Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]],
);

export const errorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /**
     * Sub-código estable para que el frontend distinga causas del mismo status
     * (p. ej. `OTP_EXPIRED` vs `OTP_INVALID`, `TWO_FACTOR_REQUIRED`).
     * Catálogo: `AUTH_REASONS` en `apps/api/src/constants/auth.ts`.
     */
    reason: z.string().optional(),
    details: z.array(errorDetailSchema).optional(),
    requestId: z.string(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

export function httpStatusForErrorCode(code: ErrorCode): number {
  return ERROR_CODES[code];
}
