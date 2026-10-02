import type { PoolClient } from 'pg';

/**
 * Write one activity log entry on the transaction's client, so the entry commits or rolls back
 * with the change it describes. Same columns and JSON as logActivity in legacy/server.js.
 */
export async function logActivity(
    client: Pick<PoolClient, 'query'>,
    userId: number,
    actionType: string,
    entityType: string,
    entityId: number,
    description: string,
    amount: unknown = null,
    oldValues: unknown = null,
    newValues: unknown = null,
): Promise<void> {
    await client.query(
        'INSERT INTO activity_log (user_id, action_type, entity_type, entity_id, description, amount, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, actionType, entityType, entityId, description, amount,
            oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null],
    );
}
