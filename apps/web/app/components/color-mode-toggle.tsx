import { Button } from "@tucatalogo/ui";
import type { ColorMode } from "@tucatalogo/types";
import { Form, useLocation } from "react-router";

import { toggleColorMode } from "~/lib/color-mode";

/**
 * Selector claro/oscuro (PLAN §10.7): formulario POST a una resource route
 * same-origin que persiste la cookie host-only y redirige. El servidor ya
 * renderizó el modo actual, así que no hay parpadeo ni `useEffect`.
 */
export interface ColorModeToggleProps {
  mode: ColorMode;
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ColorModeToggle({ mode }: ColorModeToggleProps) {
  const location = useLocation();
  const nextMode = toggleColorMode(mode);
  const label = nextMode === "dark" ? "Modo oscuro" : "Modo claro";
  const redirectTo = `${location.pathname}${location.search}`;

  return (
    <Form method="post" action="/color-mode" replace>
      <input type="hidden" name="color_mode" value={nextMode} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        aria-label={`Activar ${label.toLowerCase()}`}
      >
        {nextMode === "dark" ? <MoonIcon /> : <SunIcon />}
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </Form>
  );
}
