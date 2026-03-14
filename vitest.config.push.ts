import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["server/tests/push/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 15000,
    fileParallelism: false,
    sequence: { concurrent: false },
    env: {
      NODE_ENV: "test",
    },
  },
});
