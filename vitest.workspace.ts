import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
      globals: true,
      environment: "node",
    },
  },
  {
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      globals: true,
      environment: "node",
    },
  },
  {
    test: {
      name: "api",
      include: ["tests/api/**/*.test.ts"],
      globals: true,
      environment: "node",
    },
  },
]);
