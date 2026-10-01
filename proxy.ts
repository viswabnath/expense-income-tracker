import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, createNonce } from './lib/csp';

/**
 * Gives every page Next.js renders a per-request nonce Content-Security-Policy.
 *
 * The matcher lists only the pages Next.js owns. Paths still served by the legacy Express
 * app must not get this policy: its scripts carry no nonce and 'strict-dynamic' would block
 * them (this matters locally, where next dev forwards those paths to Express).
 * Keep this list in step with app/ and the "web" rewrites in vercel.json; a test checks all three.
 */
export function proxy(request: NextRequest) {
    const nonce = createNonce();
    const csp = buildContentSecurityPolicy({
        nonce,
        isDevelopment: process.env.NODE_ENV === 'development',
        isHttps: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
    });

    // Next.js reads the nonce from the request's CSP header and applies it to its scripts
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
}

export const config = {
    matcher: [
        '/about',
        '/security',
        '/privacy',
        '/terms',
        '/login',
        '/register',
        '/forgot-username',
        '/forgot-password',
        '/welcome',
    ],
};
