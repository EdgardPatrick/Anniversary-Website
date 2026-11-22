import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Automated tests (npm test). They run in Node, without a browser.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }, // same "@/..." imports as the app
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
