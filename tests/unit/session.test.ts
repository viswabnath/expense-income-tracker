/**
 * Unit tests for lib/session.ts: cookies signed by express-session's signer are accepted, and
 * cookies signed here are accepted by it, so both apps share one login during the migration.
 */
import type { Pool } from 'pg';
import { sessionUserId, signSessionCookie, unsignSessionCookie } from '../../lib/session';

// The signer express-session uses (a dependency of express-session)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressSigner = require('cookie-signature') as { sign(value: string, secret: string): string; unsign(value: string, secret: string): string | false };

const SECRET = 'test-secret-for-session-cookies';
const SID = 'AbC123-xyz_sessionId';

/** The cookie value as express-session sets it */
const expressCookie = (sid: string, secret = SECRET) => encodeURIComponent(`s:${expressSigner.sign(sid, secret)}`);

describe('unsignSessionCookie', () => {
    test('accepts a cookie signed by express-session', () => {
        expect(unsignSessionCookie(expressCookie(SID), SECRET)).toBe(SID);
    });

    test('express-session accepts a cookie signed here', () => {
        const value = decodeURIComponent(signSessionCookie(SID, SECRET)).slice(2);
        expect(expressSigner.unsign(value, SECRET)).toBe(SID);
    });

    test.each([
        ['another secret', expressCookie(SID, 'other-secret')],
        ['a changed session id', expressCookie(SID).replace('AbC123', 'AbC124')],
        ['no s: prefix', encodeURIComponent(expressSigner.sign(SID, SECRET))],
        ['no signature', encodeURIComponent(`s:${SID}`)],
        ['bad URL encoding', '%E0%A4%A'],
        ['an empty value', ''],
    ])('rejects %s', (_label, value) => {
        expect(unsignSessionCookie(value, SECRET)).toBeNull();
    });
});

describe('sessionUserId', () => {
    const OLD_SECRET = process.env.SESSION_SECRET;
    beforeEach(() => { process.env.SESSION_SECRET = SECRET; });
    afterAll(() => { process.env.SESSION_SECRET = OLD_SECRET; });

    function poolReturning(rows: unknown[]) {
        const query = jest.fn().mockResolvedValue({ rows });
        return { pool: { query } as unknown as Pool, query };
    }

    test('returns the user id of a live session', async () => {
        const { pool, query } = poolReturning([{ sess: { userId: 42, cookie: {} } }]);
        expect(await sessionUserId(pool, expressCookie(SID))).toBe(42);
        expect(query).toHaveBeenCalledWith('SELECT sess FROM session WHERE sid = $1 AND expire > NOW()', [SID]);
    });

    test('null for an expired or missing session, or one without a numeric user id', async () => {
        expect(await sessionUserId(poolReturning([]).pool, expressCookie(SID))).toBeNull();
        expect(await sessionUserId(poolReturning([{ sess: { userId: '42' } }]).pool, expressCookie(SID))).toBeNull();
        expect(await sessionUserId(poolReturning([{ sess: {} }]).pool, expressCookie(SID))).toBeNull();
    });

    test('null without a cookie, with a forged cookie, or without a configured secret (no query made)', async () => {
        const { pool, query } = poolReturning([{ sess: { userId: 42 } }]);
        expect(await sessionUserId(pool, undefined)).toBeNull();
        expect(await sessionUserId(pool, expressCookie(SID, 'forged'))).toBeNull();
        delete process.env.SESSION_SECRET;
        expect(await sessionUserId(pool, expressCookie(SID))).toBeNull();
        expect(query).not.toHaveBeenCalled();
    });
});
