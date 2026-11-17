import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Reino `console` (PLAN §6.2 / §7.1): Better Auth con prefijo de cookie
 * `console`, secreto propio y 2FA TOTP obligatorio.
 *
 * Better Auth resuelve los modelos `user`, `session`, `account`,
 * `verification` y `twoFactor` contra estas tablas con la opción `schema` de
 * `drizzleAdapter`; por eso los nombres de campo JS son los que espera la
 * librería (`emailVerified`, `twoFactorEnabled`, `userId`, ...).
 *
 * `created_at` / `updated_at` / `email_verified` / `two_factor_enabled` llevan
 * `$defaultFn` (default en la app, **no** en el DDL) para que la primera
 * escritura de Better Auth no dependa de que envíe esos campos.
 */

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  /** Único; normalizado a minúsculas por Better Auth / el service. */
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .$defaultFn(() => false),
  name: text("name").notNull(),
  image: text("image"),
  /** Añadido por el plugin `twoFactor` de Better Auth. */
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .notNull()
    .$defaultFn(() => false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("admin_sessions_user_id_idx").on(table.userId)],
);

export const adminAccounts = sqliteTable(
  "admin_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Hash de Better Auth; nunca texto plano. Nulo en proveedores OAuth. */
    password: text("password"),
    /**
     * Campos del modelo `account` de Better Auth. El MVP solo usa credenciales
     * (email + contraseña), así que quedan nulos; se declaran para que el
     * adaptador encuentre todas las claves del modelo si en el futuro se
     * habilita un proveedor externo.
     */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("admin_accounts_provider_account_uq").on(table.providerId, table.accountId),
    index("admin_accounts_user_id_idx").on(table.userId),
  ],
);

export const adminVerifications = sqliteTable(
  "admin_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("admin_verifications_identifier_idx").on(table.identifier),
    index("admin_verifications_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminTwoFactor = sqliteTable(
  "admin_two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /** Secreto TOTP cifrado por Better Auth. */
    secret: text("secret").notNull(),
    /** Backup codes serializados y cifrados por Better Auth (un solo uso). */
    backupCodes: text("backup_codes").notNull(),
    /**
     * `false` mientras el enrolamiento está pendiente (Better Auth escribe la
     * fila al llamar a `enableTwoFactor` y la marca `true` al verificar el
     * primer TOTP/backup code). Sin este campo el plugin `twoFactor` 1.7.x no
     * arranca; `requireAdminSession` lo exige para abrir el console (M1).
     */
    verified: integer("verified", { mode: "boolean" })
      .notNull()
      .$defaultFn(() => false),
    /** Intentos fallidos de 2FA a nivel de cuenta (bloqueo temporal). */
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .$defaultFn(() => 0),
    /** Fin del bloqueo temporal por intentos fallidos; null si no hay bloqueo. */
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("admin_two_factor_user_id_uq").on(table.userId)],
);
