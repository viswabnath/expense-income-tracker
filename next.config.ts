import type { NextConfig } from 'next';

/**
 * During the migration the legacy Express app still serves every page and API route.
 * In production, Vercel Services routes traffic (see vercel.json). Locally, `npm run dev`
 * runs Express on LEGACY_DEV_URL and this fallback rewrite forwards anything Next.js
 * does not handle, so http://localhost:3000 behaves like production.
 */
const legacyDevUrl = process.env.LEGACY_DEV_URL;

const nextConfig: NextConfig = {
    poweredByHeader: false,
    async rewrites() {
        if (process.env.NODE_ENV !== 'development' || !legacyDevUrl) {
            return [];
        }
        return {
            beforeFiles: [],
            afterFiles: [],
            fallback: [{ source: '/:path*', destination: `${legacyDevUrl}/:path*` }],
        };
    },
};

export default nextConfig;
