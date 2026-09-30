/**
 * Database transaction helpers. Framework-free, so they work unchanged from Express
 * routes today and from Next.js route handlers later.
 *
 * Never run `pool.query('BEGIN')`: a pg Pool may send each query to a different
 * connection, so the statements are not atomic and the open transaction leaks to
 * whichever request uses that connection next.
 */

/**
 * Run `fn` inside one transaction on a single checked-out connection.
 * Commits if `fn` resolves, rolls back if it throws, and always releases the connection.
 * @template T
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(pool, fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        // A failed ROLLBACK must not hide the original error
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

/**
 * An expected failure (validation, not found) raised inside a transaction.
 * Throwing it rolls the transaction back; the route turns it into an HTTP response.
 */
class RequestError extends Error {
    /**
     * @param {number} status HTTP status code
     * @param {string} message Message returned to the client
     */
    constructor(status, message) {
        super(message);
        this.name = 'RequestError';
        this.status = status;
    }
}

module.exports = { withTransaction, RequestError };
