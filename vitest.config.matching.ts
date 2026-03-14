import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["server/tests/matching/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 10000,
    fileParallelism: false,
    sequence: { concurrent: false },
    env: {
      NODE_ENV: "test",
    },
  },
});
