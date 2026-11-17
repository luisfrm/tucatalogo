import { cn } from "@tucatalogo/ui";
import { useNavigation } from "react-router";

/**
 * Estado de carga de navegación (PLAN §9.5): barra fina + anuncio accesible.
 * No bloquea la página ni sustituye el contenido ya renderizado.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-primary transition-opacity duration-150",
          busy ? "opacity-100" : "opacity-0",
        )}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? "Cargando…" : ""}
      </p>
    </>
  );
}
