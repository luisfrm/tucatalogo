import { z } from "zod";

/**
 * Formato de slug de tienda. No comprueba reservados ni cuarentena:
 * esa regla de negocio vive en `@tucatalogo/shared` y en el service del API.
 */
export const STORE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const storeSlugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(STORE_SLUG_REGEX, "Solo minúsculas, números y guiones, sin guion final");

export type StoreSlug = z.infer<typeof storeSlugSchema>;
