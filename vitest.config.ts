import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    testTimeout: 10_000,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    },
  },
});
