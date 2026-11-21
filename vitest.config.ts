import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same "@/*" -> "./*" alias as tsconfig.json, so tests import code the way the app does.
    alias: { "@": resolve(fileURLToPath(new URL(".", import.meta.url))) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
