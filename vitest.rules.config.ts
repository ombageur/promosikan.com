import { defineConfig } from "vitest/config";

// Dijalankan lewat `npm run test:rules` (di dalam firebase emulators:exec).
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
