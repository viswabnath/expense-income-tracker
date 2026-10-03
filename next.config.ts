import type { NextConfig } from 'next';

/**
 * Security headers for every response. The page Content-Security-Policy is per request (a nonce),
 * so proxy.ts sets it; API responses are JSON or CSV and never render, so they get a policy that
 * allows nothing. Vercel serves HTTPS only, so no HTTP-to-HTTPS redirect is needed here.
 * tests/unit/security-headers.test.ts checks this list.
 */
export const SECURITY_HEADERS = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

const nextConfig: NextConfig = {
    poweredByHeader: false,
    // The website and the app have separate root layouts, so unmatched addresses need a
    // standalone 404 page (app/global-not-found.tsx)
    experimental: { globalNotFound: true },
    async headers() {
        return [
            { source: '/:path*', headers: SECURITY_HEADERS },
            { source: '/api/:path*', headers: [{ key: 'Content-Security-Policy', value: API_CONTENT_SECURITY_POLICY }] },
        ];
    },
};

export default nextConfig;
