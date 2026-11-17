import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Reino `tienda` (PLAN §6.3 / §7.1): Better Auth con prefijo de cookie `store`,
 * secreto propio y **sin** 2FA (el dueño no lo usa en el MVP).
 *
 * Better Auth resuelve los modelos `user`, `session`, `account` y
 * `verification` contra estas tablas. Mismo convenio que el reino console y sin
 * ninguna tabla compartida entre reinos: el mismo email puede existir en
 * `store_users` y en `admin_users` porque son identidades distintas.
 */

export const storeUsers = sqliteTable("store_users", {
  id: text("id").primaryKey(),
  /** Único; normalizado a minúsculas por Better Auth / el service. */
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .$defaultFn(() => false),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const storeSessions = sqliteTable(
  "store_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => storeUsers.id, { onDelete: "cascade" }),
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
  (table) => [index("store_sessions_user_id_idx").on(table.userId)],
);

export const storeAccounts = sqliteTable(
  "store_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => storeUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Hash de Better Auth; nunca texto plano. Nulo en proveedores OAuth. */
    password: text("password"),
    /** Campos del modelo `account` de Better Auth; nulos en el MVP (solo credenciales). */
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
    uniqueIndex("store_accounts_provider_account_uq").on(table.providerId, table.accountId),
    index("store_accounts_user_id_idx").on(table.userId),
  ],
);

/**
 * Verificaciones temporales de Better Auth (reset de contraseña y similares,
 * PLAN §7.6). El OTP del registro **no** vive aquí: se guarda hasheado en
 * `signup_intent` y no crea sesión ni usuario (PLAN §6.4 / §7.3).
 */
export const storeVerifications = sqliteTable(
  "store_verifications",
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
    index("store_verifications_identifier_idx").on(table.identifier),
    index("store_verifications_expires_at_idx").on(table.expiresAt),
  ],
);
