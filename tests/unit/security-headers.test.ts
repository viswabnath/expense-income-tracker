/**
 * The security headers in next.config.ts (they moved from vercel.json and Helmet in N4)
 */
import nextConfig, { API_CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from '../../next.config';

describe('security headers', () => {
    test('every response gets the standard headers', async () => {
        const rules = await nextConfig.headers!();
        const all = rules.find(rule => rule.source === '/:path*');
        expect(all?.headers).toEqual(SECURITY_HEADERS);
        const byKey = Object.fromEntries(SECURITY_HEADERS.map(header => [header.key, header.value]));
        expect(byKey).toEqual({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'no-referrer',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Cross-Origin-Opener-Policy': 'same-origin',
        });
    });

    test('API responses get a policy that allows nothing; pages get theirs from proxy.ts', async () => {
        const rules = await nextConfig.headers!();
        const api = rules.find(rule => rule.source === '/api/:path*');
        expect(api?.headers).toEqual([{ key: 'Content-Security-Policy', value: API_CONTENT_SECURITY_POLICY }]);
        // No static policy on pages: a second Content-Security-Policy would block the nonce scripts
        expect(rules.filter(rule => rule.headers.some(header => header.key === 'Content-Security-Policy'))).toHaveLength(1);
    });

    test('the X-Powered-By header is off', () => {
        expect(nextConfig.poweredByHeader).toBe(false);
    });
});
