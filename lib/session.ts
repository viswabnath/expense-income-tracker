import { createHmac, timingSafeEqual } from 'crypto';
import type { Pool } from 'pg';

/**
 * Reading the legacy Express session from Next.js route handlers, so both apps accept the
 * same login while the API moves over (see docs/nextjs-migration-plan.md, "Sessions").
 *
 * express-session sends the cookie `sessionId` as `s:<sid>.<signature>` (URL-encoded), where
 * the signature is HMAC-SHA256 of the sid with SESSION_SECRET, base64 without padding (the
 * cookie-signature package). connect-pg-simple stores the session in the `session` table.
 * Creating and destroying sessions stays in Express until the auth routes move (last in N3).
 */

export const SESSION_COOKIE = 'sessionId';

function sign(sid: string, secret: string): string {
    return createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
}

/** The session id from a signed cookie value, or null if it is malformed or the signature is wrong */
export function unsignSessionCookie(cookieValue: string, secret: string): string | null {
    let value: string;
    try {
        value = decodeURIComponent(cookieValue);
    } catch {
        return null;
    }
    if (!value.startsWith('s:')) return null;
    const signed = value.slice(2);
    const dot = signed.lastIndexOf('.');
    if (dot < 1) return null;
    const sid = signed.slice(0, dot);
    const given = Buffer.from(signed.slice(dot + 1));
    const expected = Buffer.from(sign(sid, secret));
    return given.length === expected.length && timingSafeEqual(given, expected) ? sid : null;
}

/** The cookie value express-session would set for a session id (used by tests; login moves later) */
export function signSessionCookie(sid: string, secret: string): string {
    return encodeURIComponent(`s:${sid}.${sign(sid, secret)}`);
}

/**
 * The logged-in user's id for a request's session cookie, or null: no cookie, a bad signature,
 * an expired or deleted session, or no SESSION_SECRET configured.
 */
export async function sessionUserId(pool: Pool, cookieValue: string | undefined): Promise<number | null> {
    const secret = process.env.SESSION_SECRET;
    if (!cookieValue || !secret) return null;
    const sid = unsignSessionCookie(cookieValue, secret);
    if (!sid) return null;
    const result = await pool.query<{ sess: { userId?: unknown } }>(
        'SELECT sess FROM session WHERE sid = $1 AND expire > NOW()',
        [sid],
    );
    const userId = result.rows[0]?.sess?.userId;
    return typeof userId === 'number' && Number.isInteger(userId) ? userId : null;
}
