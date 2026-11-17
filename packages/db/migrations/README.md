# Migraciones D1

Migraciones SQL versionadas generadas con
`pnpm --filter @tucatalogo/db generate` (drizzle-kit a partir de `schema/`).

- `0000_great_magneto.sql`: esquema inicial de F1 (PLAN §6): 17 tablas, dos
  reinos de auth (`admin_*`, `store_*`), negocio (`store`, `category`,
  `product`, `product_image`, `hero_slide`, `signup_intent`,
  `slug_reservation`, `audit_log`), checks e índices de listado.

## Reglas

- Local: `pnpm db:migrate:local`.
- Dev/prod: `wrangler d1 migrations apply <db> --env <env> --remote` (solo en
  CI/CD, PLAN §13.2).
- **Nunca** se edita una migración ya aplicada: se añade otra.
- Toda migración debe ser compatible hacia atrás (expand/contract): primero
  añadir y desplegar, retirar en una release posterior (PLAN §13.3).
- Prod solo aplica esquema, sin seeds.
- `migrations/meta/` y `_journal.json` son parte del versionado: no se editan a
  mano.
