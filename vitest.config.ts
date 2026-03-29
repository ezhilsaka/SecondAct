import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/app/api/health/route.ts",
        "src/server/config/**/*.ts",
        "src/server/contracts/**/*.ts",
        "src/server/queue/worker.ts",
        "src/server/shared/**/*.ts"
      ],
      exclude: ["**/*.test.ts", "src/server/config/index.ts", "src/server/contracts/index.ts"]
    }
  }
});
