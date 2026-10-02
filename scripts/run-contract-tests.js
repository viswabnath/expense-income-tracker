#!/usr/bin/env node
/**
 * Run the API contract suites against a running server instead of the in-process app.
 *
 *   node scripts/run-contract-tests.js                 start legacy/server.js on port 3200 and test it
 *   node scripts/run-contract-tests.js --stack         start the production layout: Express, a Next.js
 *                                                      build and the vercel.json router, and test through
 *                                                      the router (moved routes reach Next.js, logins Express)
 *   API_BASE_URL=http://localhost:3000 node scripts/run-contract-tests.js
 *                                                      test an already running server
 *
 * The server under test must use the balancetrack_test schema.
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CONTRACT_PORT || 3200);
const CONTRACT_SUITES = [
    'tests/integration.test.js',
    'tests/atomic-writes.test.js',
    'tests/edge-cases.test.js',
    'tests/bank-deletion-fix.test.js',
    'tests/cash-balance-activity.test.js',
    'tests/entry-dates.test.js',
];

async function waitUntilUp(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // not listening yet
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Server at ${url} did not start within ${timeoutMs / 1000}s`);
}

function run(command, args, env) {
    return new Promise(resolve => {
        const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
        child.on('exit', code => resolve(code ?? 1));
    });
}

const TEST_SERVER_ENV = { NODE_ENV: 'test', DB_SCHEMA: 'balancetrack_test' };

/** Express, a production Next.js build and the router, wired like Vercel; returns the processes */
async function startStack() {
    const webPort = PORT + 1;
    const legacyPort = PORT + 2;
    const legacy = spawn('node', ['legacy/server.js'], {
        cwd: ROOT, env: { ...process.env, ...TEST_SERVER_ENV, PORT: String(legacyPort) }, stdio: 'ignore',
    });
    console.log('Building Next.js...');
    const built = await run('npx', ['next', 'build'], { LEGACY_URL: '' });
    if (built !== 0) throw new Error('next build failed');
    // Node directly (not npx), so kill() stops the server itself
    const web = spawn('node', [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '--port', String(webPort)], {
        cwd: ROOT,
        // Same safety settings as the Playwright web server: test schema only, no request limit
        env: { ...process.env, LEGACY_URL: '', DB_SCHEMA: 'balancetrack_test', REQUIRE_TEST_SCHEMA: 'true', DISABLE_RATE_LIMIT: 'true' },
        stdio: 'ignore',
    });
    const router = spawn('node', ['scripts/services-router.js'], {
        cwd: ROOT,
        env: { ...process.env, ROUTER_PORT: String(PORT), WEB_URL: `http://localhost:${webPort}`, LEGACY_URL: `http://localhost:${legacyPort}` },
        stdio: 'ignore',
    });
    await waitUntilUp(`http://localhost:${legacyPort}`);
    await waitUntilUp(`http://localhost:${webPort}/next-health`);
    await waitUntilUp(`http://localhost:${PORT}/next-health`);
    return [router, web, legacy];
}

async function main() {
    let servers = [];
    let baseUrl = process.env.API_BASE_URL;

    if (!baseUrl && process.argv.includes('--stack')) {
        baseUrl = `http://localhost:${PORT}`;
        servers = await startStack();
    } else if (!baseUrl) {
        baseUrl = `http://localhost:${PORT}`;
        servers = [spawn('node', ['legacy/server.js'], {
            cwd: ROOT,
            env: { ...process.env, ...TEST_SERVER_ENV, PORT: String(PORT) },
            stdio: 'ignore',
        })];
        await waitUntilUp(baseUrl);
    }

    console.log(`Running API contract suites against ${baseUrl}`);
    const code = await run('npx', ['jest', '--selectProjects', 'backend', '--runTestsByPath', ...CONTRACT_SUITES,
        '--detectOpenHandles', '--forceExit'], { API_BASE_URL: baseUrl });

    servers.forEach(server => server.kill());
    process.exit(code);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
