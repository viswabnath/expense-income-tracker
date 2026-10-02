/**
 * Unit tests for lib/rate-limit.ts
 */
import { allowRequest, AUTH_LIMIT, authBlocked, GENERAL_LIMIT, MemoryRateLimitStore, recordAuthFailure } from '../../lib/rate-limit';

describe('allowRequest', () => {
    const OLD = process.env.DISABLE_RATE_LIMIT;
    beforeEach(() => { delete process.env.DISABLE_RATE_LIMIT; });
    afterAll(() => { process.env.DISABLE_RATE_LIMIT = OLD; });

    test('allows 100 requests a minute per IP, then refuses until the minute is over', () => {
        const store = new MemoryRateLimitStore();
        const start = 1_000_000;
        for (let index = 0; index < GENERAL_LIMIT.max; index++) {
            expect(allowRequest('1.2.3.4', store, start + index)).toBe(true);
        }
        expect(allowRequest('1.2.3.4', store, start + 500)).toBe(false);
        // Another IP has its own count
        expect(allowRequest('5.6.7.8', store, start + 500)).toBe(true);
        // A new window starts after a minute
        expect(allowRequest('1.2.3.4', store, start + GENERAL_LIMIT.windowMs)).toBe(true);
    });

    test('DISABLE_RATE_LIMIT=true turns the limit off', () => {
        process.env.DISABLE_RATE_LIMIT = 'true';
        const store = new MemoryRateLimitStore();
        for (let index = 0; index < GENERAL_LIMIT.max + 10; index++) {
            expect(allowRequest('1.2.3.4', store, 0)).toBe(true);
        }
    });
});

describe('auth limit', () => {
    const OLD = { disable: process.env.DISABLE_RATE_LIMIT, env: process.env.NODE_ENV };
    beforeEach(() => { delete process.env.DISABLE_RATE_LIMIT; (process.env as Record<string, string>).NODE_ENV = 'production'; });
    afterAll(() => { process.env.DISABLE_RATE_LIMIT = OLD.disable; (process.env as Record<string, string | undefined>).NODE_ENV = OLD.env; });

    test('blocks an IP after 5 failed attempts in 15 minutes, until the window ends', () => {
        const store = new MemoryRateLimitStore();
        for (let index = 0; index < AUTH_LIMIT.max; index++) {
            expect(authBlocked('1.1.1.1', store, 0)).toBe(false);
            recordAuthFailure('1.1.1.1', store, 0);
        }
        expect(authBlocked('1.1.1.1', store, 1000)).toBe(true);
        expect(authBlocked('2.2.2.2', store, 1000)).toBe(false);
        expect(authBlocked('1.1.1.1', store, AUTH_LIMIT.windowMs)).toBe(false);
    });

    test('checking does not count as an attempt', () => {
        const store = new MemoryRateLimitStore();
        for (let index = 0; index < 50; index++) authBlocked('1.1.1.1', store, 0);
        expect(authBlocked('1.1.1.1', store, 0)).toBe(false);
    });

    test('skipped in development, like the legacy app', () => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        const store = new MemoryRateLimitStore();
        for (let index = 0; index < 10; index++) recordAuthFailure('1.1.1.1', store, 0);
        expect(authBlocked('1.1.1.1', store, 0)).toBe(false);
    });
});
