import type { SignupStep } from "./types";

export const SIGNUP_STEPS = [
  "Cuenta y tienda",
  "Tema",
  "Verificación",
  "Listo",
] as const;

/** Progreso visible del registro: barra + lista de pasos. */
export function Stepper({ current }: { current: SignupStep }) {
  const percent = Math.round((current / SIGNUP_STEPS.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
          Paso {current} de {SIGNUP_STEPS.length}
        </p>
        <p className="text-sm font-medium text-text">{SIGNUP_STEPS[current - 1]}</p>
      </div>

      {/*
        La barra informa del avance real (no es decorativa): es la única pista de
        progreso accesible en móvil, donde la lista de pasos está oculta
        (`sm:grid`). Por eso conserva `role="progressbar"` con nombre propio en
        lugar de `aria-hidden`, y `aria-valuetext` añade el nombre del paso.
        `aria-valuenow` va de 1 a 4 para coincidir con "Paso X de 4".
      */}
      <div
        role="progressbar"
        aria-label="Progreso del registro"
        aria-valuemin={1}
        aria-valuemax={SIGNUP_STEPS.length}
        aria-valuenow={current}
        aria-valuetext={`Paso ${current} de ${SIGNUP_STEPS.length}: ${SIGNUP_STEPS[current - 1]}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="hidden gap-2 text-xs sm:grid sm:grid-cols-4">
        {SIGNUP_STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === current;
          const isDone = stepNumber < current;
          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className={[
                "rounded-sm border px-2 py-1.5",
                isCurrent
                  ? "border-primary bg-primary-subtle font-semibold text-primary"
                  : isDone
                    ? "border-border bg-surface-2 text-text-muted"
                    : "border-border bg-surface text-text-muted",
              ].join(" ")}
            >
              {stepNumber}. {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
