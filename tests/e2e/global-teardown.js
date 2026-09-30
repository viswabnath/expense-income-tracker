/**
 * Remove every user the end-to-end run created (usernames starting with e2e_),
 * together with their data. Runs only in the isolated test schema.
 */
module.exports = async function globalTeardown() {
    process.env.DB_SCHEMA = 'balancetrack_test';
    const { query, deleteTestUser, closePool } = require('../../test-helpers');
    const { E2E_PREFIX } = require('./helpers');

    try {
        const users = await query('SELECT username FROM users WHERE username LIKE $1', [`${E2E_PREFIX}%`]);
        for (const { username } of users.rows) {
            // deleteTestUser refuses to run outside a *_test schema
            await deleteTestUser(username);
        }
    } finally {
        await closePool();
    }
};
