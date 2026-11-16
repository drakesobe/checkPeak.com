// vitest.config.mjs
// Unit + API-route tests. Tests never touch real services: Supabase, Resend and Firebase are
// replaced with in-memory fakes (tests/helpers). Run: npm test  |  npm run test:coverage
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    setupFiles: ["tests/setup.js"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      // Security- and money-critical code is held to a coverage floor; CI fails below it
      include: [
        "lib/session.js",
        "lib/requireUser.js",
        "lib/requireOrg.js",
        "lib/billingStore.js",
        "lib/org/nutritionAssign.js",
        "lib/email/athleteInvite.js",
        "middleware.js",
      ],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
