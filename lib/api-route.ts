import type { NextRequest } from 'next/server';
import { db } from './db';
import { allowRequest } from './rate-limit';
import { SESSION_COOKIE, sessionUserId } from './session';
import { RequestError } from './transaction';

/**
 * Shared plumbing for the API route handlers, matching the legacy Express app's responses:
 * the same 401 and 429 bodies, RequestError for expected failures, and a generic 500 otherwise.
 */

const GENERIC_ERROR = 'An error occurred. Please try again.';

export function jsonError(status: number, error: string): Response {
    return Response.json({ error }, { status });
}

/** The client's IP for rate limiting: the first X-Forwarded-For entry (set by Vercel and the local router) */
function clientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** The parsed JSON body, or {} when there is none or it is not an object (Express's json parser did the same) */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
    try {
        const body: unknown = await request.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

type AuthedHandler<C> = (request: NextRequest, userId: number, context: C) => Promise<Response>;

/**
 * Wrap a handler that needs a logged-in user: applies the general rate limit, reads the session
 * (401 when there is none), and turns errors into the legacy JSON responses.
 */
export function withUser<C>(handler: AuthedHandler<C>) {
    return async (request: NextRequest, context: C): Promise<Response> => {
        if (!allowRequest(clientIp(request))) {
            return jsonError(429, 'Too many requests. Please slow down.');
        }
        try {
            const userId = await sessionUserId(db(), request.cookies.get(SESSION_COOKIE)?.value);
            if (userId === null) return jsonError(401, 'Authentication required');
            return await handler(request, userId, context);
        } catch (error) {
            if (error instanceof RequestError) return jsonError(error.status, error.message);
            console.error(`${request.method} ${request.nextUrl.pathname} failed:`, error);
            return jsonError(500, GENERIC_ERROR);
        }
    };
}
