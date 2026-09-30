#!/usr/bin/env node
/**
 * Run the API contract suites against a running server instead of the in-process app.
 *
 *   node scripts/run-contract-tests.js                 start legacy/server.js on port 3200 and test it
 *   API_BASE_URL=http://localhost:3000 node scripts/run-contract-tests.js
 *                                                      test an already running server (e.g. Next.js)
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

async function main() {
    let server = null;
    let baseUrl = process.env.API_BASE_URL;

    if (!baseUrl) {
        baseUrl = `http://localhost:${PORT}`;
        server = spawn('node', ['legacy/server.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', DB_SCHEMA: 'balancetrack_test' },
            stdio: 'ignore',
        });
        await waitUntilUp(baseUrl);
    }

    console.log(`Running API contract suites against ${baseUrl}`);
    const code = await run('npx', ['jest', '--selectProjects', 'backend', '--runTestsByPath', ...CONTRACT_SUITES,
        '--detectOpenHandles', '--forceExit'], { API_BASE_URL: baseUrl });

    if (server) server.kill();
    process.exit(code);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
