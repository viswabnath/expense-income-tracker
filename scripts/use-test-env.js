/**
 * Points everything that runs tests at the separate test database. Loads .env.test (git-ignored)
 * over .env, so DB_HOST, DB_USER, DB_PASSWORD and the other connection settings come from the
 * test Supabase project, never from production. Without .env.test, the tests fall back to the
 * balancetrack_test schema of the database in .env, as before.
 *
 * Used by scripts/run-api-tests.js, playwright.config.js, tests/env.js, and preloaded
 * (node -r) by the setup-test-db and reset-test-db scripts.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const file = path.join(__dirname, '..', '.env.test');

function useTestEnv() {
    if (process.env.FINDB_TEST_ENV_LOADED) return process.env.FINDB_TEST_DB === 'separate';
    process.env.FINDB_TEST_ENV_LOADED = 'true';
    if (!fs.existsSync(file)) {
        process.env.FINDB_TEST_DB = 'shared';
        return false;
    }
    const values = dotenv.parse(fs.readFileSync(file));
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    process.env.FINDB_TEST_DB = 'separate';
    return true;
}

useTestEnv();

module.exports = { useTestEnv };
