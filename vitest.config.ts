import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // The real package throws outside React Server Components.
      "server-only": path.join(root, "tests/support/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Each file gets its own in-memory database; PGlite needs a moment to start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: "",
      APP_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "dev",
      REQUIRE_APPROVAL: "true",
      INVITES_SKIP_APPROVAL: "true",
      ADMIN_EMAILS: "",
    },
  },
});
