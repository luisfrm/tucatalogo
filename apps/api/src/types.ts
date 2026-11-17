import type { Env } from "./env";
import type { StoreRow } from "./repositories/auth-store";
export type AppEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    /** Contexto resuelto por `requireStoreSession` (nunca viene del body). */
    store?: StoreRow;
    storeId?: string;
    storeSlug?: string;
    storeOwner?: { id: string; email: string; name: string };
    /** Contexto resuelto por `requireAdminSession` (2FA completado). */
    adminId?: string;
    adminUser?: { id: string; email: string; name: string };
  };
};

/** Versión del esqueleto; el deploy real la fija en F7. */
export const APP_VERSION = "0.0.0-f1";
