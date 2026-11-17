/** Log estructurado del worker `web` (PLAN §8.7 / §12): JSON de una línea. */

export type LogFields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", event: string, fields: LogFields): void {
  const line = JSON.stringify({ level, app: "web", event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  write("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  write("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  write("error", event, fields);
}
