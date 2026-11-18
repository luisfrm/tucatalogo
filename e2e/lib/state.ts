import fs from "node:fs";
import path from "node:path";

/**
 * Estado compartido entre proyectos de Playwright.
 *
 * Cada proyecto corre en su propio worker/proceso, así que la tienda desechable
 * creada por `setup` (registro real por UI) y el admin del console se guardan en
 * `e2e/.state/run.json` (ignorado por git). No hay datos fijos en el código: el
 * slug lleva el timestamp de la ejecución.
 */
export interface StoreState {
  slug: string;
  email: string;
  password: string;
  /** Contraseña tras el flujo de recuperación. */
  passwordAfterReset?: string;
  name: string;
  storeName: string;
  categoryId?: string;
  categorySlug?: string;
  productId?: string;
  productSlug?: string;
  productIds?: string[];
  themeId?: string;
  primaryColor?: string;
}

export interface ConsoleAdminState {
  email: string;
  password: string;
  totpSecret: string;
  backupCodes: string[];
}

export interface E2eState {
  runId: string;
  startedAt: string;
  disposable: StoreState;
  qaStore: StoreState | null;
  consoleAdmin: ConsoleAdminState | null;
}

const STATE_DIR = path.resolve(process.cwd(), "e2e", ".state");
const STATE_FILE = path.join(STATE_DIR, "run.json");
const PANEL_STATE_FILE = path.join(STATE_DIR, "panel.json");
const CONSOLE_ADMIN_FILE = path.join(STATE_DIR, "console-admin.json");

export function statePath(): string {
  return STATE_FILE;
}

/**
 * `storageState` con la sesión del dueño de la tienda desechable.
 *
 * Los tests de aislamiento y de console reutilizan esta sesión en lugar de
 * volver a hacer login: el MVP limita a 5 intentos/15 min por IP+email y los
 * E2E no deben agotarlos.
 */
export function panelStatePath(): string {
  return PANEL_STATE_FILE;
}

export function writeState(state: E2eState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/**
 * Credenciales del admin del console, **persistentes entre ejecuciones**.
 *
 * `/init` es one-time: si la D1 local ya tiene un admin no se puede crear otro,
 * y el E2E reutiliza el que creó la pasada anterior. `setup` reescribe
 * `run.json` en cada ejecución (con `consoleAdmin: null`), así que el admin vive
 * en su propio archivo y `patchState` lo mantiene al día cuando el proyecto
 * `console` rota la contraseña o consume un backup code.
 *
 * Si se vacía el reino admin (`reset-admin.mjs`), el archivo queda huérfano:
 * la siguiente pasada ve `/init` disponible, crea un admin nuevo y lo
 * sobrescribe. No hace falta borrarlo a mano.
 */
export function consoleAdminPath(): string {
  return CONSOLE_ADMIN_FILE;
}

export function readConsoleAdmin(): ConsoleAdminState | null {
  if (!fs.existsSync(CONSOLE_ADMIN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONSOLE_ADMIN_FILE, "utf8")) as ConsoleAdminState;
  } catch {
    // Archivo corrupto: se trata como ausente y el test lo reporta con motivo.
    return null;
  }
}

export function writeConsoleAdmin(admin: ConsoleAdminState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(CONSOLE_ADMIN_FILE, `${JSON.stringify(admin, null, 2)}\n`, "utf8");
}

export function readState(): E2eState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      "Falta e2e/.state/run.json. Ejecuta el proyecto `setup` antes (pnpm test:e2e).",
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as E2eState;
}

export function patchState(patch: Partial<E2eState>): E2eState {
  const next = { ...readState(), ...patch };
  writeState(next);
  // El admin del console vive también en su propio archivo: cualquier cambio
  // (contraseña rotada, backup code consumido) tiene que sobrevivir a `setup`.
  if (next.consoleAdmin) writeConsoleAdmin(next.consoleAdmin);
  return next;
}
