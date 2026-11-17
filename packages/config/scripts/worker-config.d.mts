export interface WorkerConfig {
  workers_dev?: boolean;
  preview_urls?: boolean;
  routes?: unknown;
  route?: unknown;
  vars?: Record<string, unknown>;
  env?: Record<string, WorkerConfig>;
  [key: string]: unknown;
}

export const REPO_ROOT: string;
export const WORKER_APPS: readonly string[];
export const FRONTEND_APPS: readonly string[];

export function stripJsonComments(input: string): string;
export function stripTrailingCommas(input: string): string;
export function parseJsonc(input: string): WorkerConfig;
export function loadWorkerConfig(app: string): WorkerConfig;
export function checkWorkerConfig(app: string, config: WorkerConfig): string[];
export function checkAllWorkerConfigs(): Array<{
  app: string;
  errors: string[];
}>;
