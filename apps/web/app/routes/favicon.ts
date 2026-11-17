import { redirect } from "react-router";

/**
 * Los navegadores antiguos piden `/favicon.ico` aunque el HTML declare el SVG.
 * Se redirige al favicon único para que esa petición no acabe en 404.
 */
export function loader() {
  return redirect("/favicon.svg", 308);
}
