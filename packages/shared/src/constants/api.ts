/**
 * El API local corre SIEMPRE en 9797 (PLAN §13.1).
 * No hay valor alternativo: si falta la configuración, el adapter falla con 503.
 */
export const LOCAL_API_PORT = 9797;
export const LOCAL_API_URL = `http://127.0.0.1:${LOCAL_API_PORT}`;
export const LOCAL_MEDIA_BASE_URL = `${LOCAL_API_URL}/media`;
