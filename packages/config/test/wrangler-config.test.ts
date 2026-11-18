import { describe, expect, it } from "vitest";

import {
  checkAllWorkerConfigs,
  checkWorkerConfig,
  loadWorkerConfig,
  type WorkerConfig,
} from "../scripts/worker-config.mjs";

describe("A1: hosts de los workers", () => {
  it("todas las apps cumplen workers_dev/preview_urls/routes", () => {
    for (const result of checkAllWorkerConfigs()) {
      expect(result.errors, result.app).toEqual([]);
    }
  });

  it("el api no puede declarar routes", () => {
    const api = loadWorkerConfig("api");
    const withRoutes: WorkerConfig = {
      ...api,
      routes: [{ pattern: "api.tucatalogo.live/*" }],
    };

    expect(checkWorkerConfig("api", withRoutes)).toContain(
      "top-level no puede declarar routes (A1)",
    );

    const envWithRoutes: WorkerConfig = {
      ...api,
      env: {
        ...api.env,
        dev: { ...api.env?.dev, routes: [{ pattern: "api-dev.tucatalogo.live/*" }] },
      },
    };

    expect(checkWorkerConfig("api", envWithRoutes).join("\n")).toContain(
      "env.dev no puede declarar routes (A1)",
    );
  });

  it("el api exige workers_dev=false en top-level, dev y prod", () => {
    const api = loadWorkerConfig("api");

    expect(
      checkWorkerConfig("api", { ...api, workers_dev: true }).join("\n"),
    ).toContain("top-level.workers_dev debe ser false");

    const devOpen: WorkerConfig = {
      ...api,
      env: { ...api.env, dev: { ...api.env?.dev, workers_dev: true } },
    };
    expect(checkWorkerConfig("api", devOpen).join("\n")).toContain(
      "env.dev.workers_dev debe ser false",
    );
  });

  it("los frontends no exponen prod en workers.dev ni con preview URLs", () => {
    for (const app of ["web", "commercial", "console"]) {
      const config = loadWorkerConfig(app);

      const prodOpen: WorkerConfig = {
        ...config,
        env: {
          ...config.env,
          prod: { ...config.env?.prod, workers_dev: true },
        },
      };
      expect(checkWorkerConfig(app, prodOpen).join("\n")).toContain(
        "env.prod.workers_dev debe ser false",
      );

      const previewOpen: WorkerConfig = {
        ...config,
        env: {
          ...config.env,
          prod: { ...config.env?.prod, preview_urls: true },
        },
      };
      expect(checkWorkerConfig(app, previewOpen).join("\n")).toContain(
        "env.prod.preview_urls debe ser false",
      );
    }
  });

  it("dev mantiene workers_dev=true y preview_urls=false", () => {
    const web = loadWorkerConfig("web");
    const devBroken: WorkerConfig = {
      ...web,
      env: {
        ...web.env,
        dev: { ...web.env?.dev, workers_dev: false, preview_urls: true },
      },
    };

    const errors = checkWorkerConfig("web", devBroken).join("\n");
    expect(errors).toContain("env.dev.workers_dev debe ser true");
    expect(errors).toContain("env.dev.preview_urls debe ser false");
  });
});

describe("B9: Turnstile en commercial", () => {
  it("solo local puede usar el modo test", () => {
    const commercial = loadWorkerConfig("commercial");

    expect(commercial.env?.dev?.vars?.TURNSTILE_MODE).toBe("enabled");
    expect(commercial.env?.prod?.vars?.TURNSTILE_MODE).toBe("enabled");
  });

  it("dev sigue con placeholder y prod lleva la site key pública real", () => {
    const commercial = loadWorkerConfig("commercial");

    expect(commercial.env?.dev?.vars?.TURNSTILE_SITE_KEY).toBe(
      "REPLACE_ME_DEV_TURNSTILE_SITE_KEY",
    );

    // La site key de Turnstile es pública: el valor canónico vive en
    // `wrangler.jsonc` (env.prod), nunca en GitHub. prod ya no admite placeholders.
    const prodSiteKey = commercial.env?.prod?.vars?.TURNSTILE_SITE_KEY;
    expect(String(prodSiteKey)).not.toContain("REPLACE_ME");
    expect(prodSiteKey).toBe("0x4AAAAAAGF7HGDrrRDDGsww");
  });
});

describe("routing: tiendas en la subzona tucatalogo.live", () => {
  const DOMAIN = "tucatalogo.live";

  it("web enruta la subzona de tiendas y resuelve contra ella", () => {
    const web = loadWorkerConfig("web");

    expect(web.env?.prod?.routes).toEqual([{ pattern: `*.${DOMAIN}/*`, zone_name: DOMAIN }]);
    expect(web.env?.prod?.vars?.APP_DOMAIN).toBe(DOMAIN);
  });

  it("commercial va en el apex y console en su host exacto", () => {
    const commercial = loadWorkerConfig("commercial");
    const consoleApp = loadWorkerConfig("console");

    // Todo dentro de la misma zona: apex para commercial, host exacto para console.
    expect(commercial.env?.prod?.routes).toEqual([{ pattern: `${DOMAIN}/*`, zone_name: DOMAIN }]);
    expect(commercial.env?.prod?.vars?.APP_DOMAIN).toBe(DOMAIN);
    expect(consoleApp.env?.prod?.routes).toEqual([
      { pattern: `console.${DOMAIN}/*`, zone_name: DOMAIN },
    ]);
    expect(consoleApp.env?.prod?.vars?.APP_DOMAIN).toBe(DOMAIN);
  });

  it("el api construye los enlaces contra el dominio nuevo", () => {
    const api = loadWorkerConfig("api");

    expect(api.env?.prod?.vars?.APP_DOMAIN).toBe(DOMAIN);
    expect(api.env?.prod?.vars?.STORE_ORIGIN_TEMPLATE).toBe(`https://{slug}.${DOMAIN}`);
    expect(api.env?.prod?.vars?.CONSOLE_ORIGIN).toBe(`https://console.${DOMAIN}`);
    expect(api.env?.prod?.vars?.MEDIA_BASE_URL).toBe(`https://bucket.${DOMAIN}`);
    expect(api.env?.prod?.vars?.EMAIL_FROM).toBe("TuCatálogo <no-reply@tucatalogo.live>");
  });
});
