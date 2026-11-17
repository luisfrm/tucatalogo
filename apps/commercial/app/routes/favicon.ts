import { redirect } from "react-router";

/**
 * Los navegadores antiguos piden `/favicon.ico` aunque el HTML declare el SVG.
 * Se redirige al favicon único (`public/favicon.svg`) para que esa petición no
 * acabe en 404. Igual que en `web` y `console`.
 */
export function loader() {
  return redirect("/favicon.svg", 308);
}
