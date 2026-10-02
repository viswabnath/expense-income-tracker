// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3100);
const WEB_PORT = PORT + 1;
const LEGACY_PORT = PORT + 2;

/**
 * End-to-end tests of real user flows, routed the way production is: scripts/services-router.js
 * on PORT applies the vercel.json rewrites and sends each request to a production build of
 * Next.js (WEB_PORT) or the legacy Express app (LEGACY_PORT). Next.js runs without a fallback
 * proxy, as on Vercel. Express uses the isolated balancetrack_test schema, never production
 * data (public).
 * Set E2E_BASE_URL to run them against an already running or deployed app instead.
 */
module.exports = defineConfig({
    testDir: './tests/e2e',
    // Flows share one database; run them one at a time like the Jest suites
    workers: 1,
    fullyParallel: false,
    // Each step round-trips to the remote database, so full flows take a while
    timeout: 180_000,
    expect: { timeout: 15_000 },
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    globalTeardown: './tests/e2e/global-teardown.js',
    use: {
        baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: process.env.E2E_BASE_URL ? undefined : [
        {
            command: 'node legacy/server.js',
            url: `http://localhost:${LEGACY_PORT}`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: {
                PORT: String(LEGACY_PORT),
                NODE_ENV: 'test',
                DB_SCHEMA: 'balancetrack_test',
            },
        },
        {
            // Built and run exactly as on Vercel: no LEGACY_URL, so no fallback proxy
            command: `npx next build && npx next start --port ${WEB_PORT}`,
            url: `http://localhost:${WEB_PORT}/next-health`,
            reuseExistingServer: false,
            timeout: 240_000,
            // Next.js now serves API routes too: same test schema as Express (never production),
            // and no request limit, like the legacy app in its test environment
            env: {
                LEGACY_URL: '',
                DB_SCHEMA: 'balancetrack_test',
                REQUIRE_TEST_SCHEMA: 'true',
                DISABLE_RATE_LIMIT: 'true',
            },
        },
        {
            command: 'node scripts/services-router.js',
            url: `http://localhost:${PORT}/next-health`,
            reuseExistingServer: false,
            timeout: 30_000,
            env: {
                ROUTER_PORT: String(PORT),
                WEB_URL: `http://localhost:${WEB_PORT}`,
                LEGACY_URL: `http://localhost:${LEGACY_PORT}`,
            },
        },
    ],
});
