import type { NextConfig } from 'next';

/**
 * During the migration the legacy Express app serves every path Next.js does not own.
 * In production, Vercel Services routes traffic (see vercel.json) and LEGACY_URL is unset.
 * Locally (`npm run dev`, Playwright), Express runs on LEGACY_URL and this fallback rewrite
 * forwards anything Next.js does not handle, so localhost behaves like production.
 * Rewrites are fixed at build time, so LEGACY_URL must be set for `next build` too.
 */
const legacyUrl = process.env.LEGACY_URL;

const nextConfig: NextConfig = {
    poweredByHeader: false,
    async rewrites() {
        if (!legacyUrl) {
            return [];
        }
        return {
            beforeFiles: [],
            afterFiles: [],
            fallback: [{ source: '/:path*', destination: `${legacyUrl}/:path*` }],
        };
    },
};

export default nextConfig;
