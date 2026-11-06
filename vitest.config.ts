import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match the app build (React automatic JSX runtime) so components that do not
  // import React explicitly can be rendered in tests.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "client/src/**/*.test.tsx", "server/**/*.test.ts"],
  },
});
