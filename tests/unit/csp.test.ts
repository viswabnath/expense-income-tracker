/**
 * Unit tests for lib/csp.ts
 */
import { buildContentSecurityPolicy, createNonce } from '../../lib/csp';

function directives(policy: string): Map<string, string> {
    return new Map(policy.split('; ').map(part => {
        const [name, ...values] = part.split(' ');
        return [name ?? '', values.join(' ')];
    }));
}

describe('buildContentSecurityPolicy', () => {
    test('allows scripts only with the nonce (and what they load), never inline handlers', () => {
        const policy = directives(buildContentSecurityPolicy({ nonce: 'abc123', isDevelopment: false, isHttps: true }));

        expect(policy.get('script-src')).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
        expect(policy.get('script-src-attr')).toBe("'none'");
        expect(policy.get('object-src')).toBe("'none'");
        expect(policy.get('frame-ancestors')).toBe("'self'");
        expect(policy.get('font-src')).toBe("'self'");
    });

    test('adds unsafe-eval only in development', () => {
        const dev = directives(buildContentSecurityPolicy({ nonce: 'n', isDevelopment: true, isHttps: false }));
        const prod = directives(buildContentSecurityPolicy({ nonce: 'n', isDevelopment: false, isHttps: false }));

        expect(dev.get('script-src')).toContain("'unsafe-eval'");
        expect(prod.get('script-src')).not.toContain("'unsafe-eval'");
    });

    test('upgrades insecure requests only over HTTPS (Safari applies it to http://localhost)', () => {
        const https = buildContentSecurityPolicy({ nonce: 'n', isDevelopment: false, isHttps: true });
        const http = buildContentSecurityPolicy({ nonce: 'n', isDevelopment: false, isHttps: false });

        expect(https).toContain('upgrade-insecure-requests');
        expect(http).not.toContain('upgrade-insecure-requests');
    });
});

describe('createNonce', () => {
    test('returns a different base64 value each time', () => {
        const first = createNonce();
        const second = createNonce();

        expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(first).not.toBe(second);
        expect(Buffer.from(first, 'base64')).toHaveLength(16);
    });
});
