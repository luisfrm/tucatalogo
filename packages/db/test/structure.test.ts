import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getTableConfig } from "drizzle-orm/sqlite-core";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import * as schema from "../schema/index";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(packageDir, "migrations");
const seedsDir = join(packageDir, "seeds");

/**
 * Verificación del esquema sin D1: se inspecciona la configuración que Drizzle
 * expone para cada tabla (`getTableConfig`) y el SQL generado en `migrations/`.
 * Las constraints se probaron además contra D1 local con
 * `wrangler d1 execute ... --local` (ver reporte de F1).
 */

const TABLES = {
  admin_users: schema.adminUsers,
  admin_sessions: schema.adminSessions,
  admin_accounts: schema.adminAccounts,
  admin_verifications: schema.adminVerifications,
  admin_two_factor: schema.adminTwoFactor,
  store_users: schema.storeUsers,
  store_sessions: schema.storeSessions,
  store_accounts: schema.storeAccounts,
  store_verifications: schema.storeVerifications,
  signup_intent: schema.signupIntents,
  store: schema.stores,
  category: schema.categories,
  product: schema.products,
  product_image: schema.productImages,
  hero_slide: schema.heroSlides,
  slug_reservation: schema.slugReservations,
  audit_log: schema.auditLogs,
  rate_limit_counter: schema.rateLimitCounters,
} satisfies Record<string, SQLiteTable>;

const tableConfig = (table: SQLiteTable) => getTableConfig(table);
const tableName = (table: SQLiteTable) => tableConfig(table).name;
const columnsOf = (table: SQLiteTable) => tableConfig(table).columns.map((c) => c.name);

const migrationFiles = readdirSync(migrationsDir)
  .filter((entry) => entry.endsWith(".sql"))
  .sort();
const migrationSql = migrationFiles
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n");

function indexByName(table: SQLiteTable, name: string) {
  return tableConfig(table).indexes.find((index) => index.config.name === name);
}

function indexColumnNames(table: SQLiteTable, name: string): string[] {
  const index = indexByName(table, name);
  if (!index) return [];
  return index.config.columns.map((column) => (column as SQLiteColumn).name ?? "<sql>");
}

/** Pares (tabla, columna, onDelete) de las FK declaradas. */
function foreignKeysOf(table: SQLiteTable) {
  return tableConfig(table).foreignKeys.map((fk) => ({
    column: fk.reference().columns[0]?.name,
    table: tableName(fk.reference().foreignTable),
    onDelete: fk.onDelete ?? "no action",
  }));
}

/** Conjuntos únicos: inline `unique()`, `uniqueIndex` y `unique()` compuesto. */
function uniqueColumnSets(table: SQLiteTable): string[][] {
  const config = tableConfig(table);
  const sets: string[][] = [
    ...config.uniqueConstraints.map((constraint) => constraint.columns.map((c) => c.name)),
    ...config.indexes
      .filter((index) => index.config.unique)
      .map((index) => index.config.columns.map((c) => (c as SQLiteColumn).name ?? "<sql>")),
  ];

  for (const column of config.columns) {
    if ((column as unknown as { isUnique?: boolean }).isUnique === true) {
      sets.push([column.name]);
    }
  }

  return sets;
}

function expectUnique(table: SQLiteTable, columns: string[]) {
  expect(uniqueColumnSets(table)).toContainEqual(columns);
}

describe("estructura de packages/db", () => {
  it("mantiene las carpetas que consumen los subagentes y el CI", () => {
    expect(existsSync(join(packageDir, "schema", "index.ts"))).toBe(true);
    expect(existsSync(migrationsDir)).toBe(true);
    expect(existsSync(seedsDir)).toBe(true);
    expect(existsSync(join(packageDir, "drizzle.config.ts"))).toBe(true);
  });

  it("declara las 17 tablas de PLAN §6 más el contador de rate limit de F2", () => {
    expect(Object.keys(TABLES)).toHaveLength(18);
    for (const [name, table] of Object.entries(TABLES)) {
      expect(tableName(table)).toBe(name);
    }
  });
});

const EXPECTED_COLUMNS: Record<keyof typeof TABLES, string[]> = {
  admin_users: ["id", "email", "email_verified", "name", "image", "two_factor_enabled", "created_at", "updated_at"],
  admin_sessions: ["id", "user_id", "token", "expires_at", "ip_address", "user_agent", "created_at", "updated_at"],
  admin_accounts: [
    "id",
    "user_id",
    "account_id",
    "provider_id",
    "password",
    "access_token",
    "refresh_token",
    "id_token",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "created_at",
    "updated_at",
  ],
  admin_verifications: ["id", "identifier", "value", "expires_at", "created_at", "updated_at"],
  admin_two_factor: [
    "id",
    "user_id",
    "secret",
    "backup_codes",
    "verified",
    "failed_verification_count",
    "locked_until",
    "created_at",
    "updated_at",
  ],
  store_users: ["id", "email", "email_verified", "name", "image", "created_at", "updated_at"],
  store_sessions: ["id", "user_id", "token", "expires_at", "ip_address", "user_agent", "created_at", "updated_at"],
  store_accounts: [
    "id",
    "user_id",
    "account_id",
    "provider_id",
    "password",
    "access_token",
    "refresh_token",
    "id_token",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "created_at",
    "updated_at",
  ],
  store_verifications: ["id", "identifier", "value", "expires_at", "created_at", "updated_at"],
  signup_intent: ["id", "email", "otp_hash", "attempts", "expires_at", "last_sent_at", "consumed_at", "ip_hash", "created_at"],
  store: [
    "id",
    "owner_id",
    "slug",
    "name",
    "status",
    "suspended_by",
    "suspended_reason",
    "suspended_at",
    "theme_id",
    "primary_color",
    "color_mode_default",
    "currency",
    "plan",
    "whatsapp_number",
    "whatsapp_message_template",
    "logo_key",
    "created_at",
    "updated_at",
  ],
  category: ["id", "store_id", "name", "slug", "sort_order", "created_at", "updated_at"],
  product: [
    "id",
    "store_id",
    "category_id",
    "name",
    "slug",
    "description",
    "price_minor",
    "is_active",
    "is_deleted",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  product_image: ["id", "product_id", "r2_key", "alt", "width", "height", "sort_order", "created_at"],
  hero_slide: [
    "id",
    "store_id",
    "image_desktop_key",
    "image_mobile_key",
    "title",
    "subtitle",
    "cta_label",
    "cta_url",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at",
  ],
  slug_reservation: ["id", "slug", "store_id", "reason", "reserved_until", "created_at"],
  audit_log: [
    "id",
    "actor_type",
    "actor_id",
    "store_id",
    "store_slug",
    "action",
    "target_type",
    "target_id",
    "metadata",
    "ip_hash",
    "created_at",
  ],
  rate_limit_counter: ["bucket", "count", "window_started_at", "expires_at", "updated_at"],
};

describe("columnas por tabla", () => {
  for (const [name, table] of Object.entries(TABLES)) {
    it(`${name} expone exactamente las columnas de PLAN §6`, () => {
      expect(columnsOf(table)).toEqual(EXPECTED_COLUMNS[name as keyof typeof TABLES]);
    });
  }

  it("store no tiene isActive y product no duplica currency", () => {
    expect(columnsOf(schema.stores)).not.toContain("is_active");
    expect(columnsOf(schema.products)).not.toContain("currency");
  });

  it("signup_intent nunca guarda contraseña, nombre ni slug", () => {
    const columns = columnsOf(schema.signupIntents);
    expect(columns).not.toContain("password");
    expect(columns).not.toContain("name");
    expect(columns).not.toContain("slug");
    expect(columns).toContain("otp_hash");
  });
});

describe("unicidad", () => {
  it("una cuenta = una tienda y slug único", () => {
    expectUnique(schema.stores, ["slug"]);
    expectUnique(schema.stores, ["owner_id"]);
  });

  it("email único en ambos reinos", () => {
    expectUnique(schema.adminUsers, ["email"]);
    expectUnique(schema.storeUsers, ["email"]);
  });

  it("slug único por tienda en categoría y slug único global en cuarentena", () => {
    expectUnique(schema.categories, ["store_id", "slug"]);
    expectUnique(schema.slugReservations, ["slug"]);
  });

  it("tokens de sesión y credenciales por proveedor", () => {
    expectUnique(schema.adminSessions, ["token"]);
    expectUnique(schema.storeSessions, ["token"]);
    expectUnique(schema.adminAccounts, ["provider_id", "account_id"]);
    expectUnique(schema.storeAccounts, ["provider_id", "account_id"]);
    expectUnique(schema.adminTwoFactor, ["user_id"]);
  });

  it("producto: UNIQUE(store_id, slug) parcial WHERE is_deleted = 0", () => {
    const index = indexByName(schema.products, "product_store_slug_uq");

    expect(index).toBeDefined();
    expect(index?.config.unique).toBe(true);
    expect(indexColumnNames(schema.products, "product_store_slug_uq")).toEqual(["store_id", "slug"]);
    // El índice es parcial: sólo se genera DDL con WHERE si `where` está definido.
    expect(index?.config.where).toBeDefined();
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX `product_store_slug_uq` ON `product` (`store_id`,`slug`) WHERE "product"."is_deleted" = 0;',
    );
  });
});

describe("checks", () => {
  it("acota status, suspended_by, currency y color_mode_default", () => {
    const checks = tableConfig(schema.stores).checks.map((check) => check.name);

    expect(checks).toEqual(
      expect.arrayContaining([
        "store_status_ck",
        "store_suspended_by_ck",
        "store_suspension_consistency_ck",
        "store_currency_ck",
        "store_color_mode_default_ck",
      ]),
    );
    expect(checks).toHaveLength(5);
  });

  it("el SQL generado usa los valores del enum y la coherencia de suspensión", () => {
    expect(migrationSql).toContain(
      "CHECK(\"store\".\"status\" in ('pending','active','suspended'))",
    );
    expect(migrationSql).toContain(
      "CHECK(\"store\".\"suspended_by\" is null or \"store\".\"suspended_by\" in ('owner','admin'))",
    );
    expect(migrationSql).toContain(
      "CHECK((\"store\".\"status\" = 'suspended') = (\"store\".\"suspended_by\" is not null))",
    );
    expect(migrationSql).toContain(
      "CHECK(\"store\".\"currency\" in ('USD','EUR','COP','VES','ARS'))",
    );
    expect(migrationSql).toContain(
      "CHECK(\"store\".\"color_mode_default\" in ('light','dark'))",
    );
  });

  it("precio no negativo y actor_type acotado", () => {
    expect(migrationSql).toContain('CHECK("product"."price_minor" >= 0)');
    expect(migrationSql).toContain("CHECK(\"audit_log\".\"actor_type\" in ('admin','owner','system'))");
  });

  it("ninguna columna declara DEFAULT en DDL (el service asigna estado y configuración)", () => {
    expect(migrationSql).not.toMatch(/\bDEFAULT\b/i);
  });
});

describe("índices de listado", () => {
  const listingIndexes: Array<[SQLiteTable, string, string[]]> = [
    [schema.products, "product_store_listing_idx", ["store_id", "is_deleted", "is_active", "sort_order"]],
    [schema.products, "product_store_category_idx", ["store_id", "category_id"]],
    [schema.productImages, "product_image_product_sort_idx", ["product_id", "sort_order"]],
    [schema.heroSlides, "hero_slide_store_active_sort_idx", ["store_id", "is_active", "sort_order"]],
    [schema.signupIntents, "signup_intent_email_idx", ["email"]],
    [schema.signupIntents, "signup_intent_expires_at_idx", ["expires_at"]],
    [schema.slugReservations, "slug_reservation_reserved_until_idx", ["reserved_until"]],
  ];

  for (const [table, name, columns] of listingIndexes) {
    it(`${name} cubre (${columns.join(", ")})`, () => {
      expect(indexColumnNames(table, name)).toEqual(columns);
    });
  }

  it("audit_log indexa por tienda, actor y acción, con created_at descendente", () => {
    for (const name of [
      "audit_log_store_created_idx",
      "audit_log_actor_created_idx",
      "audit_log_action_created_idx",
    ]) {
      const index = indexByName(schema.auditLogs, name);
      expect(index).toBeDefined();
      expect(index?.config.columns).toHaveLength(2);
    }

    expect(migrationSql).toContain(
      'CREATE INDEX `audit_log_store_created_idx` ON `audit_log` (`store_id`,"created_at" desc);',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX `audit_log_actor_created_idx` ON `audit_log` (`actor_id`,"created_at" desc);',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX `audit_log_action_created_idx` ON `audit_log` (`action`,"created_at" desc);',
    );
  });

  it("las tablas de verificación buscan por identifier", () => {
    expect(indexColumnNames(schema.storeVerifications, "store_verifications_identifier_idx")).toEqual([
      "identifier",
    ]);
    expect(indexColumnNames(schema.adminVerifications, "admin_verifications_identifier_idx")).toEqual([
      "identifier",
    ]);
  });
});

describe("claves foráneas", () => {
  it("cascade en los hijos de tienda y producto", () => {
    expect(foreignKeysOf(schema.categories)).toContainEqual({
      column: "store_id",
      table: "store",
      onDelete: "cascade",
    });
    expect(foreignKeysOf(schema.products)).toContainEqual({
      column: "store_id",
      table: "store",
      onDelete: "cascade",
    });
    expect(foreignKeysOf(schema.productImages)).toContainEqual({
      column: "product_id",
      table: "product",
      onDelete: "cascade",
    });
    expect(foreignKeysOf(schema.heroSlides)).toContainEqual({
      column: "store_id",
      table: "store",
      onDelete: "cascade",
    });
  });

  it("product.category_id es set null: borrar la categoría no borra productos", () => {
    expect(foreignKeysOf(schema.products)).toContainEqual({
      column: "category_id",
      table: "category",
      onDelete: "set null",
    });
  });

  it("sesiones, cuentas y 2FA caen con su usuario", () => {
    for (const table of [schema.adminSessions, schema.adminAccounts, schema.adminTwoFactor]) {
      expect(foreignKeysOf(table)).toContainEqual({
        column: "user_id",
        table: "admin_users",
        onDelete: "cascade",
      });
    }
    for (const table of [schema.storeSessions, schema.storeAccounts]) {
      expect(foreignKeysOf(table)).toContainEqual({
        column: "user_id",
        table: "store_users",
        onDelete: "cascade",
      });
    }
  });

  it("store.owner_id apunta a store_users; el borrado de la tienda sigue el orden de PLAN §6.13", () => {
    expect(foreignKeysOf(schema.stores)).toEqual([
      { column: "owner_id", table: "store_users", onDelete: "no action" },
    ]);
  });

  it("slug_reservation y audit_log no tienen FK: sobreviven al borrado", () => {
    expect(foreignKeysOf(schema.slugReservations)).toEqual([]);
    expect(foreignKeysOf(schema.auditLogs)).toEqual([]);
  });
});

describe("migraciones y seeds", () => {
  it("hay al menos una migración versionada con journal", () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(existsSync(join(migrationsDir, "meta", "_journal.json"))).toBe(true);
  });

  it("la migración crea las 17 tablas", () => {
    for (const name of Object.keys(TABLES)) {
      expect(migrationSql).toContain(`CREATE TABLE \`${name}\``);
    }
  });

  it("no versiona seeds de usuarios de auth (el primer admin se crea con /init)", () => {
    const seedFiles = readdirSync(seedsDir).filter((entry) => entry.endsWith(".sql"));
    for (const file of seedFiles) {
      const sql = readFileSync(join(seedsDir, file), "utf8");
      expect(sql).not.toMatch(/INSERT\s+INTO\s+`?(admin_users|store_users)`?/i);
    }
  });
});
