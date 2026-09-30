// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3100);

/**
 * End-to-end tests of real user flows. They start the app against the isolated
 * balancetrack_test schema, never production data (public).
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
    webServer: process.env.E2E_BASE_URL ? undefined : {
        command: 'node legacy/server.js',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            PORT: String(PORT),
            NODE_ENV: 'test',
            DB_SCHEMA: 'balancetrack_test',
        },
    },
});
