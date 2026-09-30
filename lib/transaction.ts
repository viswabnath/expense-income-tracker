/**
 * Database transaction helpers for the Next.js app. Framework-free (no Next.js imports).
 * Same behaviour as legacy/lib/transaction.js, which the Express app uses until N4.
 *
 * Never run `pool.query('BEGIN')`: a pg Pool may send each query to a different
 * connection, so the statements are not atomic and the open transaction leaks to
 * whichever request uses that connection next.
 */
import type { Pool, PoolClient } from 'pg';

/** The part of a pg Pool these helpers need; makes them easy to test without a database */
export type TransactionPool = Pick<Pool, 'connect'>;

/**
 * Run `fn` inside one transaction on a single checked-out connection.
 * Commits if `fn` resolves, rolls back if it throws, and always releases the connection.
 */
export async function withTransaction<T>(
    pool: TransactionPool,
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
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
export class RequestError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'RequestError';
        this.status = status;
    }
}
