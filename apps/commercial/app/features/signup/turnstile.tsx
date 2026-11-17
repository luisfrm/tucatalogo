import { useEffect, useRef } from "react";

/**
 * Widget de Turnstile (PLAN §9.7). El token se envía al API y se verifica en
 * servidor: aquí solo se renderiza el widget y se expone el token.
 *
 * - `render=explicit`: nosotros decidimos cuándo y dónde se pinta.
 * - Cada token sirve una sola vez; tras usarlo se pide `reset` con `resetSignal`.
 * - Si el script no carga, se avisa al padre (`onToken(null)`) para que el
 *   registro muestre el error en lugar de continuar sin verificación.
 */
interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | number;
  reset(widgetId?: string | number): void;
  remove(widgetId?: string | number): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile-script]",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile")));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile")));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Se llama si el script no carga o el widget falla: el registro lo muestra. */
  onError?: () => void;
  /** Cambiar este número fuerza `reset` en el widget. */
  resetSignal: number;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
  resetSignal,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | number | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: "es",
          theme: "light",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => {
            onTokenRef.current(null);
            onErrorRef.current?.();
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        onTokenRef.current(null);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
      }
      widgetRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
    }
  }, [resetSignal]);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-muted">Verificación anti-bot</p>
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}
