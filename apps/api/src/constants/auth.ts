/**
 * Constantes de autenticación y anti-abuso (PLAN §7.3, §7.7, §8.8).
 *
 * Un solo sitio para los números del contrato: si cambia un límite, cambia
 * aquí y en `PLAN.md`. Los tests verdes son la prueba de que ambos coinciden.
 */

/** Cabeceras internas que fija el worker que atiende el host público. */
export const AUTH_HEADERS = {
  /**
   * Slug de la tienda resuelto en servidor (`Host` o `?siteId` en dev/local).
   * **Nunca** se lee del body. El frontend debe sobrescribir cualquier valor
   * enviado por el navegador.
   */
  storeSlug: "x-store-slug",
  /**
   * IP real del cliente, cuando el worker frontal la conoce. Solo se usa para
   * rate limiting y hashing; nunca se registra en claro.
   */
  clientIp: "x-client-ip",
} as const;

/** Origen interno con el que habla Better Auth: nunca el `Origin` del cliente. */
export const INTERNAL_AUTH_ORIGIN = "http://api.internal";

/** Base paths de cada reino (PLAN §7.1). */
export const AUTH_BASE_PATH = {
  store: "/auth/store",
  console: "/auth/console",
} as const;

/** Prefijos de cookie, host-only y sin `domain` (PLAN §7.2). */
export const COOKIE_PREFIX = {
  store: "store",
  console: "console",
} as const;

/** Duración de sesión: 7 días con renovación (tienda), 8 h fijas (console). */
export const SESSION_POLICY = {
  store: { expiresInSeconds: 60 * 60 * 24 * 7, updateAgeSeconds: 60 * 60 * 24 },
  console: { expiresInSeconds: 60 * 60 * 8, updateAgeSeconds: 60 * 60 * 8 },
} as const;

/** OTP de registro (PLAN §7.3). */
export const SIGNUP_OTP = {
  length: 6,
  ttlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  resendCooldownMs: 60 * 1000,
} as const;

/** Enlaces de recuperación (PLAN §7.6): 30 minutos, un solo uso. */
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

/**
 * Challenge de enrolamiento del console (M1): token propio, 10 minutos, un
 * solo uso. No es una sesión: solo sirve para completar el TOTP en
 * `/auth/console/2fa/verify`.
 */
export const CONSOLE_ENROLLMENT = {
  ttlMs: 10 * 60 * 1000,
  /** Prefijo del `identifier` en `admin_verifications`. */
  prefix: "console-enrollment:",
} as const;

/** Rutas de los frontends donde aterriza el enlace de reset. */
export const PASSWORD_RESET_PATH = {
  store: "/panel-admin/reset-password",
  console: "/reset-password",
} as const;

/** Valores por defecto de una tienda recién creada (PLAN §4.5 A / §6.5). */
export const STORE_DEFAULTS = {
  plan: "free",
  status: "active",
  themeId: "rose",
  colorModeDefault: "light",
  whatsappMessageTemplate: "¡Hola {tienda}! Me interesa {producto} ({precio}).",
} as const;

export interface RateLimitRule {
  /** Máximo de peticiones en la ventana. */
  max: number;
  /** Ventana en milisegundos. */
  windowMs: number;
}

/**
 * Límites mínimos de PLAN §7.7. `key` identifica la operación en el bucket de
 * D1; el sufijo del bucket lo pone el route (email/IP/sesión hasheados).
 */
export const RATE_LIMITS = {
  storeLogin: { max: 5, windowMs: 15 * 60 * 1000 },
  consoleLogin: { max: 5, windowMs: 15 * 60 * 1000 },
  consoleTwoFactor: { max: 5, windowMs: 15 * 60 * 1000 },
  otpRequestByEmail: { max: 3, windowMs: 60 * 60 * 1000 },
  otpRequestByIp: { max: 10, windowMs: 60 * 60 * 1000 },
  signupCompleteByIp: { max: 5, windowMs: 60 * 60 * 1000 },
  passwordResetByEmail: { max: 3, windowMs: 60 * 60 * 1000 },
  passwordResetByIp: { max: 10, windowMs: 60 * 60 * 1000 },
  /**
   * Consumo de tokens de reset (B4): frena la fuerza bruta de tokens
   * inválidos por IP, sin depender de que el token exista.
   */
  passwordResetTokenByIp: { max: 10, windowMs: 15 * 60 * 1000 },
  consoleInitByIp: { max: 5, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitOperation = keyof typeof RATE_LIMITS;

/** Códigos de razón estables que viajan en `error.reason` (contrato frontend). */
export const AUTH_REASONS = {
  storeSlugMissing: "STORE_SLUG_MISSING",
  storeSlugInvalid: "STORE_SLUG_INVALID",
  storeNotFound: "STORE_NOT_FOUND",
  storeMismatch: "STORE_MISMATCH",
  invalidCredentials: "INVALID_CREDENTIALS",
  twoFactorRequired: "TWO_FACTOR_REQUIRED",
  twoFactorEnrollmentRequired: "TWO_FACTOR_ENROLLMENT_REQUIRED",
  twoFactorInvalid: "TWO_FACTOR_INVALID",
  otpInvalid: "OTP_INVALID",
  otpExpired: "OTP_EXPIRED",
  otpAttemptsExhausted: "OTP_ATTEMPTS_EXHAUSTED",
  otpCooldown: "OTP_COOLDOWN",
  emailTaken: "EMAIL_TAKEN",
  slugTaken: "SLUG_TAKEN",
  slugReserved: "SLUG_RESERVED",
  slugQuarantined: "SLUG_QUARANTINED",
  slugFormat: "SLUG_FORMAT",
  turnstileFailed: "TURNSTILE_FAILED",
  initConsumed: "INIT_CONSUMED",
  initTokenInvalid: "INIT_TOKEN_INVALID",
  themeUnavailable: "THEME_UNAVAILABLE",
  configMissing: "CONFIG_MISSING",
  /** M1: el challenge de enrolamiento no vale (caducado, usado o inventado). */
  enrollmentTokenInvalid: "ENROLLMENT_TOKEN_INVALID",
  /** M1: el 2FA ya está verificado; no se puede volver a enrolar. */
  twoFactorAlreadyEnabled: "TWO_FACTOR_ALREADY_ENABLED",
  /** B4: contraseña incorrecta en una reautenticación. */
  invalidPassword: "INVALID_PASSWORD",
} as const;

export type AuthReason = (typeof AUTH_REASONS)[keyof typeof AUTH_REASONS];

/** Mensajes en español listos para usuario final (PLAN §8.3). */
export const AUTH_MESSAGES = {
  storeSlugMissing: "Falta el identificador de la tienda.",
  storeSlugInvalid: "El identificador de la tienda no es válido.",
  storeNotFound: "La tienda no existe.",
  storeMismatch: "No tienes acceso a esta tienda.",
  invalidCredentials: "Email o contraseña incorrectos.",
  twoFactorRequired: "Falta el segundo factor.",
  twoFactorInvalid: "El código de verificación no es válido.",
  otpInvalid: "El código no es correcto.",
  otpExpired: "El código caducó. Pide uno nuevo.",
  otpAttemptsExhausted: "Demasiados intentos. Pide un código nuevo.",
  otpCooldown: "Espera un momento antes de pedir otro código.",
  emailTaken: "Ese email ya tiene una cuenta.",
  slugTaken: "Ese identificador ya está en uso.",
  slugReserved: "Ese identificador está reservado.",
  slugQuarantined: "Ese identificador no está disponible todavía.",
  turnstileFailed: "No pudimos verificar que no eres un robot.",
  initConsumed: "El alta inicial ya se completó.",
  configMissing: "Configuración incompleta en el servidor.",
  rateLimited: "Demasiados intentos. Inténtalo más tarde.",
  enrollmentInvalid: "El proceso de alta del 2FA caducó. Vuelve a empezar.",
  twoFactorAlreadyEnabled: "El 2FA ya está activo.",
  invalidPassword: "La contraseña no es correcta.",
} as const;
