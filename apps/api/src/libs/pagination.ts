/**
 * Ventana de paginación compartida por panel, público y console.
 * El `pageSize` lo fija el API (constante por superficie); el cliente solo
 * elige la página.
 */
export function pageWindow(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
