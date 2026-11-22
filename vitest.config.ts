import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same "@/*" -> "./*" alias as tsconfig.json, so tests import code the way the app does.
    alias: { "@": resolve(fileURLToPath(new URL(".", import.meta.url))) },
  },
  test: {
    // .tsx tests opt in to a browser-like DOM with a `// @vitest-environment jsdom` first line;
    // the logic tests stay in plain Node.
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});