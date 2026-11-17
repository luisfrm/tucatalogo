import { beforeEach, describe, expect, it } from "vitest";

import { isSafeMediaKey } from "../src/libs/media";
import { mediaEnabled } from "../src/routes/media";
import { testEnv } from "./env";
import { createStore, panelMultipart, readJson, resetAdminRealm } from "./fixtures";
import { api } from "./helpers";
import { logoForm } from "./webp";

beforeEach(async () => {
  await resetAdminRealm();
});

describe("GET /media/* (dev-only)", () => {
  it("sirve el objeto de R2 con su Content-Type y cache inmutable", async () => {
    const fixture = await createStore();
    const logo = await panelMultipart(fixture, "/panel/store/logo", logoForm());
    const { logoKey } = await readJson<{ logoKey: string }>(logo);

    const response = await api(`/${"media"}/${logoKey}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("content-length")).toBeTruthy();

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(20);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
  });

  it("404 para keys inexistentes y rutas fuera de stores/", async () => {
    const fixture = await createStore();

    expect((await api(`/media/stores/${fixture.storeId}/nada.webp`)).status).toBe(404);
    expect((await api("/media/otra-cosa/x.webp")).status).toBe(404);
    expect((await api("/media/stores/%2e%2e/secret.webp")).status).toBe(404);
    expect((await api("/media/")).status).toBe(404);
  });

  it("solo se monta en local/development", () => {
    expect(mediaEnabled("local")).toBe(true);
    expect(mediaEnabled("development")).toBe(true);
    expect(mediaEnabled("production")).toBe(false);
    expect(mediaEnabled(undefined)).toBe(false);
  });

  it("rechaza traversal y paths fuera del prefijo de tienda", () => {
    expect(isSafeMediaKey("stores/abc/logo/x.webp")).toBe(true);
    expect(isSafeMediaKey("stores/abc/products/1/u-full.webp")).toBe(true);
    expect(isSafeMediaKey("otra/abc/x.webp")).toBe(false);
    expect(isSafeMediaKey("stores/../secret")).toBe(false);
    expect(isSafeMediaKey("stores//x")).toBe(false);
    expect(isSafeMediaKey("/stores/x")).toBe(false);
    expect(isSafeMediaKey("stores/x/")).toBe(false);
    expect(isSafeMediaKey("stores/a\\b")).toBe(false);
    expect(isSafeMediaKey("stores/<script>")).toBe(false);
  });

  it("el objeto servido existe realmente en el bucket local", async () => {
    const fixture = await createStore();
    const logo = await panelMultipart(fixture, "/panel/store/logo", logoForm());
    const { logoKey } = await readJson<{ logoKey: string }>(logo);

    const stored = await testEnv.MEDIA_BUCKET.get(logoKey);
    expect(stored).toBeTruthy();
    expect(stored?.httpMetadata?.contentType).toBe("image/webp");
  });
});
