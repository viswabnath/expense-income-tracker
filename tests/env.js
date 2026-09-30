/**
 * Runs before every test file (Jest `setupFiles`), before any module connects to the database.
 * Tests share the production Supabase database, so they must use the isolated *_test schema.
 * dotenv does not override variables that are already set, so this wins over .env.
 */
process.env.NODE_ENV = 'test';

if (!/_test$/.test(process.env.DB_SCHEMA || '')) {
    process.env.DB_SCHEMA = 'balancetrack_test';
}
