import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
);

export const WORKER_APPS = ["api", "web", "commercial", "console"];
export const FRONTEND_APPS = ["web", "commercial", "console"];

/**
 * Quita comentarios `//` y `/* *\/` respetando el contenido de strings.
 */
export function stripJsonComments(input) {
  let output = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

/** Quita comas finales fuera de strings (wrangler.jsonc las admite). */
export function stripTrailingCommas(input) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < input.length && /\s/.test(input[lookahead])) {
        lookahead += 1;
      }
      if (input[lookahead] === "}" || input[lookahead] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

export function parseJsonc(input) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(input)));
}

export function loadWorkerConfig(app) {
  const path = join(REPO_ROOT, "apps", app, "wrangler.jsonc");
  return parseJsonc(readFileSync(path, "utf8"));
}

function requireSection(errors, label, section) {
  if (section === undefined || section === null || typeof section !== "object") {
    errors.push(`${label} no existe`);
    return false;
  }
  return true;
}

function checkFlag(errors, label, section, key, expected) {
  if (section[key] !== expected) {
    errors.push(`${label}.${key} debe ser ${expected} (A1)`);
  }
}

/**
 * A1: el API no puede tener hostname público ni rutas; los frontends solo
 * exponen *.workers.dev en dev y nunca preview URLs.
 */
export function checkWorkerConfig(app, config) {
  const errors = [];

  if (app === "api") {
    checkFlag(errors, "top-level", config, "workers_dev", false);
    checkFlag(errors, "top-level", config, "preview_urls", false);

    if (config.routes || config.route) {
      errors.push("top-level no puede declarar routes (A1)");
    }

    for (const envName of ["dev", "prod"]) {
      const label = `env.${envName}`;
      const section = config.env?.[envName];
      if (!requireSection(errors, label, section)) {
        continue;
      }
      checkFlag(errors, label, section, "workers_dev", false);
      checkFlag(errors, label, section, "preview_urls", false);
      if (section.routes || section.route) {
        errors.push(`${label} no puede declarar routes (A1)`);
      }
    }

    return errors;
  }

  const dev = config.env?.dev;
  if (requireSection(errors, "env.dev", dev)) {
    checkFlag(errors, "env.dev", dev, "workers_dev", true);
    checkFlag(errors, "env.dev", dev, "preview_urls", false);
  }

  const prod = config.env?.prod;
  if (requireSection(errors, "env.prod", prod)) {
    checkFlag(errors, "env.prod", prod, "workers_dev", false);
    checkFlag(errors, "env.prod", prod, "preview_urls", false);
  }

  return errors;
}

export function checkAllWorkerConfigs() {
  return WORKER_APPS.map((app) => ({
    app,
    errors: checkWorkerConfig(app, loadWorkerConfig(app)),
  }));
}
