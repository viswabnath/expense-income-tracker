/**
 * Runs before every test file (Jest `setupFiles`), before any module connects to the database.
 * Tests use the separate test database from .env.test when it exists (otherwise the main
 * database), and always the isolated *_test schema.
 * dotenv does not override variables that are already set, so this wins over .env.
 */
process.env.NODE_ENV = 'test';

// The separate test database (.env.test), when it is set up
require('../scripts/use-test-env');

if (!/_test$/.test(process.env.DB_SCHEMA || '')) {
    process.env.DB_SCHEMA = 'balancetrack_test';
}
