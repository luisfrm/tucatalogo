/**
 * Instancias de Better Auth por reino, cacheadas por isolate.
 *
 * `wrangler` reutiliza el isolate entre peticiones; reconstruir la instancia en
 * cada request es correcto pero innecesario. La clave incluye entorno y
 * secreto: un cambio de secreto (rotación) invalida la caché.
 */
import { createConsoleAuth, type ConsoleAuth } from "./console";
import { createStoreAuth, type StoreAuth } from "./store";
import type { Env } from "../env";

const storeAuthCache = new Map<string, StoreAuth>();
const consoleAuthCache = new Map<string, ConsoleAuth>();

export function getStoreAuth(env: Env): StoreAuth {
  const key = `${env.ENVIRONMENT}|${env.BETTER_AUTH_SECRET_STORE ?? ""}`;
  const cached = storeAuthCache.get(key);
  if (cached) return cached;
  const auth = createStoreAuth(env);
  storeAuthCache.set(key, auth);
  return auth;
}

export function getConsoleAuth(env: Env): ConsoleAuth {
  const key = `${env.ENVIRONMENT}|${env.BETTER_AUTH_SECRET_CONSOLE ?? ""}`;
  const cached = consoleAuthCache.get(key);
  if (cached) return cached;
  const auth = createConsoleAuth(env);
  consoleAuthCache.set(key, auth);
  return auth;
}
