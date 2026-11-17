import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que `tsconfig.cloudflare.json` (`~/* → ./app/*`).
    alias: { "~": path.resolve(import.meta.dirname, "app") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
