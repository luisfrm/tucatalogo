# Seeds SQL locales/dev

Solo **local** y **dev**. Producción se despliega únicamente con esquema
(PLAN §13.3). El primer admin del console **no** es seed: se crea con `/init`.

`pnpm db:seed:local` aplica en orden alfabético los `*.sql` de esta carpeta
contra la D1 local (`tucatalogo-local`, `--local` fijo en el runner). El seed de
`dev` lo ejecutará el CI (F7) con su propia D1 y los mismos archivos; este
script nunca apunta a un entorno remoto.

## Contrato de un seed

1. **Nombre versionado**: `0001_descripcion.sql`, `0002_...`. Nunca se reescribe
   un archivo ya aplicado.
2. **Idempotente**: aunque el runner no reaplica un archivo con el mismo
   checksum, el propio SQL debe usar ids deterministas y `INSERT OR IGNORE` /
   `ON CONFLICT DO NOTHING`. Así un `--force` o una D1 recreada no duplica filas.
3. **Sin usuarios de auth**: nada de `INSERT INTO admin_users` ni
   `store_users`. El primer admin se crea por `/init` y los dueños por el
   registro con OTP.
4. **Sin datos de producción**: solo fixtures de desarrollo, con dominios
   `example.test` y claves R2 ficticias (`stores/<storeId>/...`).
5. **Sin PII real, sin secretos, sin OTP ni tokens.**

## Idempotencia del runner

El runner guarda el SHA-256 de cada archivo aplicado en la tabla local
`_local_seed_history`, que crea el propio script (misma naturaleza que
`d1_migrations` de wrangler). No está en `migrations/`, así que no existe en
prod. Si un archivo cambia después de aplicarse, el runner falla en vez de
reaplicarlo en silencio:

```bash
pnpm db:seed:local            # aplica lo pendiente
pnpm db:seed:local -- --force # reaplica todo y actualiza checksums
```

Hoy no hay seeds: la tienda demo necesita el flujo de auth (F2) para existir y
se añadirá cuando ese flujo esté cerrado.
