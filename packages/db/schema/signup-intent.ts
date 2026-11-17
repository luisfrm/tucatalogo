import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Intent de registro verificado por OTP (PLAN §6.4 / §7.3).
 *
 * Nada más se persiste antes del OTP: **no** guarda contraseña, ni nombre, ni
 * slug. El payload del paso 1 sigue en el formulario del navegador y se reenvía
 * al POST final, donde se revalida. Sin tienda `pending` ni purga a 24 h.
 *
 * `attempts` lo inicializa el service en 0 y lo incrementa en cada intento
 * fallido (a los 5 el intent queda inválido); no lleva `DEFAULT` (PLAN §6.1).
 */
export const signupIntents = sqliteTable(
  "signup_intent",
  {
    id: text("id").primaryKey(),
    /** Minúsculas; índice para localizar el intent vigente. */
    email: text("email").notNull(),
    /** Hash del código de 6 caracteres; nunca el código en claro. */
    otpHash: text("otp_hash").notNull(),
    attempts: integer("attempts").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    /** Base del reenvío (espera de 60 s). */
    lastSentAt: integer("last_sent_at", { mode: "timestamp_ms" }).notNull(),
    /** Marca de un solo uso; null mientras el intent está vivo. */
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    /** Hash de IP para límites; sin IP en claro. */
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("signup_intent_email_idx").on(table.email),
    index("signup_intent_expires_at_idx").on(table.expiresAt),
  ],
);
