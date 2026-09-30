#!/usr/bin/env node
/**
 * Local development during the Next.js migration.
 *
 * Starts the legacy Express app on LEGACY_PORT (default 3001) and `next dev` on 3000.
 * Next.js forwards every path it does not handle to Express (see next.config.ts), so
 * http://localhost:3000 routes requests the same way Vercel Services does in production.
 *
 * Note: the database comes from .env. Without DB_SCHEMA it is production data (public).
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_PORT = process.env.LEGACY_PORT || '3001';

const children = [
    spawn('npx', ['nodemon', '--watch', 'legacy', 'legacy/server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: LEGACY_PORT },
        stdio: 'inherit',
    }),
    spawn('npx', ['next', 'dev', '--port', '3000'], {
        cwd: ROOT,
        env: { ...process.env, LEGACY_DEV_URL: `http://localhost:${LEGACY_PORT}` },
        stdio: 'inherit',
    }),
];

function stopAll(code) {
    for (const child of children) child.kill();
    process.exit(code);
}

for (const child of children) {
    child.on('exit', (code) => stopAll(code ?? 0));
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
