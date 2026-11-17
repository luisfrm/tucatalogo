import { z } from "zod";

import { storeSlugSchema } from "./slug";
import { currencySchema, storeStatusSchema } from "./store";

/**
 * Contratos de autenticación (PLAN §4.5 A/B/C/F, §7 y §8.2).
 *
 * Los mismos schemas los usan los loaders/actions de los frontends y el API:
 * una sola fuente de verdad para email, contraseña, OTP y payload de registro.
 * Ninguno de estos objetos transporta tokens ni contraseñas hasheadas hacia el
 * cliente.
 */

/** Normaliza el email igual que Better Auth (trim + minúsculas). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Introduce un email válido"));

/** Contraseña: 8–128 caracteres (límites de Better Auth). */
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña es demasiado larga");

/** Código OTP de 6 dígitos. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "El código tiene 6 dígitos");

/** Slug de tienda tal como lo escribe el usuario (se normaliza en servidor). */
export const slugInputSchema = z.string().trim().min(1).max(80);

/** Identificador de tema: se valida contra `@tucatalogo/themes` en el service. */
export const themeIdSchema = z.string().trim().min(1).max(40);

/** Color de marca `#RRGGBB` (el motor OKLCH ajusta contraste al escribir). */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un hex #RRGGBB");

/** WhatsApp en E.164 sin `+` (ej. `584121234567`). */
export const whatsappNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{8,15}$/, "El WhatsApp debe llevar código de país, sin +");

/** `GET /auth/store/slug-check?slug=`. */
export const slugCheckInputSchema = z.object({ slug: slugInputSchema });

export const SLUG_CHECK_REASONS = [
  "empty",
  "format",
  "reserved",
  "taken",
  "quarantined",
] as const;

export const slugCheckReasonSchema = z.enum(SLUG_CHECK_REASONS);
export type SlugCheckReason = z.infer<typeof slugCheckReasonSchema>;

export const slugCheckResponseSchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  reason: slugCheckReasonSchema.nullable(),
  /** Enlaces sugeridos cuando el slug está disponible. */
  links: z
    .object({ storefront: z.string(), panel: z.string() })
    .nullable(),
});
export type SlugCheckResponse = z.infer<typeof slugCheckResponseSchema>;

/** `POST /auth/store/signup/otp`. */
export const signupOtpSchema = z.object({
  email: emailSchema,
  slug: storeSlugSchema,
  turnstileToken: z.string().trim().min(1, "Falta la verificación anti-bot"),
});
export type SignupOtpInput = z.infer<typeof signupOtpSchema>;

/** `POST /auth/store/signup`: el payload completo del paso 1 + el código. */
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: emailSchema,
  password: passwordSchema,
  storeName: z.string().trim().min(2, "Escribe el nombre de la tienda").max(80),
  slug: storeSlugSchema,
  currency: currencySchema,
  themeId: themeIdSchema,
  primaryColor: hexColorSchema.optional(),
  whatsappNumber: whatsappNumberSchema.optional(),
  code: otpCodeSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Resumen de tienda y de usuario que devuelve el API (sin tokens). */
export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const storeSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: storeStatusSchema,
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;

export const signupResponseSchema = z.object({
  user: authUserSchema,
  store: storeSummarySchema,
  links: z.object({ storefront: z.string(), panel: z.string() }),
});
export type SignupResponse = z.infer<typeof signupResponseSchema>;

/** `POST /auth/store/login`. */
export const storeLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña").max(128),
});
export type StoreLoginInput = z.infer<typeof storeLoginSchema>;

export const storeSessionResponseSchema = z.object({
  user: authUserSchema,
  store: storeSummarySchema,
  expiresAt: z.string(),
});
export type StoreSessionResponse = z.infer<typeof storeSessionResponseSchema>;

/** `POST /auth/{store,console}/password/forgot`. */
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** `POST /auth/{store,console}/password/reset`. */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** `POST /auth/console/init` (one-time, INIT_TOKEN solo en el api). */
export const consoleInitSchema = z.object({
  initToken: z.string().trim().min(1, "Falta el token de alta"),
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type ConsoleInitInput = z.infer<typeof consoleInitSchema>;

export const consoleInitResponseSchema = z.object({
  admin: authUserSchema,
  /** Se muestra una sola vez: el admin debe guardarlo. */
  backupCodes: z.array(z.string()),
  totpUri: z.string(),
  /** El enrolamiento sigue pendiente: no hay sesión hasta `/2fa/verify`. */
  enrollmentRequired: z.literal(true),
  /**
   * Challenge de enrolamiento (M1). Token de un solo uso, 10 min. Se envía en
   * el body de `/auth/console/2fa/verify`; no es una cookie ni una sesión.
   */
  enrollmentToken: z.string(),
});
export type ConsoleInitResponse = z.infer<typeof consoleInitResponseSchema>;

/** `POST /auth/console/login`. */
export const consoleLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña").max(128),
});
export type ConsoleLoginInput = z.infer<typeof consoleLoginSchema>;

export const consoleLoginResponseSchema = z.object({
  admin: authUserSchema.nullable(),
  twoFactorRequired: z.boolean(),
  /** `true` cuando aún no hay TOTP verificado: hay que enrolar antes de entrar. */
  enrollmentRequired: z.boolean(),
  /** Challenge de enrolamiento (solo si `enrollmentRequired`). Sin sesión. */
  enrollmentToken: z.string().optional(),
});
export type ConsoleLoginResponse = z.infer<typeof consoleLoginResponseSchema>;

/**
 * `POST /auth/console/2fa/setup`: re-emite el secreto TOTP con la contraseña.
 * Devuelve el `totpUri`, los backup codes y un challenge de enrolamiento.
 */
export const twoFactorSetupSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;

export const twoFactorSetupResponseSchema = z.object({
  totpUri: z.string(),
  backupCodes: z.array(z.string()),
  enrollmentToken: z.string(),
});
export type TwoFactorSetupResponse = z.infer<typeof twoFactorSetupResponseSchema>;

/**
 * `POST /auth/console/2fa/verify` (TOTP o backup code).
 *
 * `enrollmentToken` completa el enrolamiento (no hay sesión previa); sin él se
 * usa la cookie `two_factor` del login normal.
 */
export const twoFactorVerifySchema = z
  .object({
    code: z.string().trim().min(6).max(40),
    type: z.enum(["totp", "backup"]).default("totp"),
    enrollmentToken: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.type === "totp" || value.enrollmentToken === undefined, {
    path: ["type"],
    message: "Los backup codes solo se usan con una sesión iniciada",
  });
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;

export const adminSessionResponseSchema = z.object({
  admin: authUserSchema.extend({ twoFactorEnabled: z.literal(true) }),
  expiresAt: z.string(),
});
export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;
