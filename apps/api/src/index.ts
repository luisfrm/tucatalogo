/**
 * Worker `api`: entrada del Worker.
 *
 * Las rutas de negocio (auth de los dos reinos, panel, público, console y
 * media) se montan encadenadas en `app.ts`, que es lo que define `AppType`
 * para `packages/api-client` (Hono RPC).
 *
 * Aquí solo se añade `/dev/*`, la ayuda de desarrollo del outbox de email en
 * memoria: se queda **fuera** del contrato tipado a propósito y se apaga sola
 * fuera de `local` (responde 404).
 */
import { app } from "./app";
import { devRoutes } from "./routes/dev";

app.route("/dev", devRoutes);

export default app;
