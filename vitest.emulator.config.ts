import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Tes yang butuh Emulator Suite: Security Rules + integrasi Cloud Functions.
// Dijalankan lewat `npm run test:emulator` (firebase emulators:exec).
export default defineConfig({
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("./shared", import.meta.url)) },
  },
  test: {
    include: ["tests/rules/**/*.test.ts", "tests/e2e/**/*.test.ts", "functions/src/**/*.test.ts"],
    env: { GCLOUD_PROJECT: "demo-promosikan" },
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
