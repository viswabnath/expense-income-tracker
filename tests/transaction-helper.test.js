/**
 * Unit tests for lib/transaction.js (no database)
 * @jest-environment node
 */

const { withTransaction, RequestError } = require('../legacy/lib/transaction');

function mockPool({ failOn } = {}) {
    const statements = [];
    const client = {
        query: jest.fn(async (sql) => {
            statements.push(sql);
            if (failOn && sql === failOn) throw new Error(`${sql} failed`);
            return { rows: [] };
        }),
        release: jest.fn()
    };
    return { pool: { connect: jest.fn(async () => client) }, client, statements };
}

describe('withTransaction', () => {
    test('runs BEGIN, the work and COMMIT on one connection, then releases it', async () => {
        const { pool, client, statements } = mockPool();

        const result = await withTransaction(pool, async (tx) => {
            await tx.query('INSERT 1');
            return 'done';
        });

        expect(result).toBe('done');
        expect(pool.connect).toHaveBeenCalledTimes(1);
        expect(statements).toEqual(['BEGIN', 'INSERT 1', 'COMMIT']);
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('rolls back and rethrows when the work throws', async () => {
        const { pool, client, statements } = mockPool();
        const failure = new RequestError(400, 'Insufficient bank balance');

        await expect(withTransaction(pool, async () => { throw failure; })).rejects.toBe(failure);

        expect(statements).toEqual(['BEGIN', 'ROLLBACK']);
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('keeps the original error when ROLLBACK itself fails', async () => {
        const { pool, client } = mockPool({ failOn: 'ROLLBACK' });
        const failure = new Error('insert failed');

        await expect(withTransaction(pool, async () => { throw failure; })).rejects.toBe(failure);
        expect(client.release).toHaveBeenCalledTimes(1);
        // The connection's state is unknown, so it is closed rather than reused
        expect(client.release.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('rolls back when COMMIT fails', async () => {
        const { pool, client, statements } = mockPool({ failOn: 'COMMIT' });

        await expect(withTransaction(pool, async () => 'ok')).rejects.toThrow('COMMIT failed');
        expect(statements).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});

describe('RequestError', () => {
    test('carries an HTTP status and message', () => {
        const error = new RequestError(404, 'Income transaction not found');

        expect(error).toBeInstanceOf(Error);
        expect(error.status).toBe(404);
        expect(error.message).toBe('Income transaction not found');
    });
});
