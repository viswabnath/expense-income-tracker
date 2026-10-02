/**
 * Unit tests for lib/rate-limit.ts
 */
import { allowRequest, GENERAL_LIMIT, MemoryRateLimitStore } from '../../lib/rate-limit';

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
