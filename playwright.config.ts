import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build on port 3100 with a fresh
 * copy of the demo data. By default the data lives in PGlite under .data/e2e;
 * set E2E_DATABASE_URL to run against PostgreSQL instead (its data is wiped).
 * Set E2E_SERVER=dev to use the development server, which starts faster.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const useDevServer = process.env.E2E_SERVER === "dev";

const serverEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
  PGLITE_DIR: ".data/e2e",
  APP_URL: baseURL,
  APP_TIMEZONE: "Asia/Kolkata",
  REQUIRE_APPROVAL: "true",
  INVITES_SKIP_APPROVAL: "true",
  ADMIN_EMAILS: "",
  // Emails are kept in the database and read back from the development mailbox.
  EMAIL_TRANSPORT: "dev",
  DANGEROUSLY_ALLOW_DEV_MAILBOX: "true",
  SMTP_URL: "",
  TRUST_PROXY: "false",
  // Signs session cookies in this test server only.
  BETTER_AUTH_SECRET: "e2e-only-secret-6f1c0b9a4e2d47c8a3b5f7e9d1c2b4a6",
};

const prepare = "npm run db:migrate && npm run db:seed -- --reset";
// E2E_SKIP_BUILD=1 reuses the last production build.
const build = process.env.E2E_SKIP_BUILD ? "" : "next build && ";
const serve = useDevServer ? `next dev --port ${port}` : `${build}next start --port ${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  // The tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${prepare} && ${serve}`,
    url: `${baseURL}/api/health`,
    env: serverEnv,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
