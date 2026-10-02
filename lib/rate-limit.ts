/**
 * Request rate limits for the API route handlers, matching the legacy Express limits:
 * 100 requests per minute per IP, and 5 failed auth attempts per 15 minutes per IP. Counts are kept in memory, so each server instance counts
 * separately, exactly like express-rate-limit's default store today. The store sits behind
 * RateLimitStore, so a shared store (for example Redis) can replace it without touching handlers.
 *
 * Skipped when DISABLE_RATE_LIMIT=true (the end-to-end and contract runs drive a server faster
 * than a person would; the legacy app skips its limit in its test environment the same way).
 * The auth limit is also skipped in development, like the legacy app's.
 */

export interface RateLimitStore {
    /** Count one hit for key in the current window; returns the count so far in that window */
    hit(key: string, windowMs: number, now: number): number;
    /** The count so far in the current window, without counting a hit */
    peek(key: string, windowMs: number, now: number): number;
}

export class MemoryRateLimitStore implements RateLimitStore {
    private readonly windows = new Map<string, { start: number; count: number }>();

    peek(key: string, windowMs: number, now: number): number {
        const current = this.windows.get(key);
        return current && now - current.start < windowMs ? current.count : 0;
    }

    hit(key: string, windowMs: number, now: number): number {
        const current = this.windows.get(key);
        if (!current || now - current.start >= windowMs) {
            // Drop expired windows now and then so the map does not grow without bound
            if (this.windows.size > 10_000) {
                for (const [entryKey, entry] of this.windows) {
                    if (now - entry.start >= windowMs) this.windows.delete(entryKey);
                }
            }
            this.windows.set(key, { start: now, count: 1 });
            return 1;
        }
        current.count += 1;
        return current.count;
    }
}

export const GENERAL_LIMIT = { max: 100, windowMs: 60_000 };

const generalStore = new MemoryRateLimitStore();

/** False when this IP has used up the general limit for the current minute */
export function allowRequest(ip: string, store: RateLimitStore = generalStore, now: number = Date.now()): boolean {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return true;
    return store.hit(`general:${ip}`, GENERAL_LIMIT.windowMs, now) <= GENERAL_LIMIT.max;
}

export const AUTH_LIMIT = { max: 5, windowMs: 15 * 60_000 };

const authStore = new MemoryRateLimitStore();

const authLimitSkipped = () => process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'development';

/** True when this IP has had 5 failed auth attempts in the last 15 minutes (successful ones do not count) */
export function authBlocked(ip: string, store: RateLimitStore = authStore, now: number = Date.now()): boolean {
    if (authLimitSkipped()) return false;
    return store.peek(`auth:${ip}`, AUTH_LIMIT.windowMs, now) >= AUTH_LIMIT.max;
}

/** Count one failed auth attempt (any 4xx or 5xx answer) */
export function recordAuthFailure(ip: string, store: RateLimitStore = authStore, now: number = Date.now()): void {
    if (authLimitSkipped()) return;
    store.hit(`auth:${ip}`, AUTH_LIMIT.windowMs, now);
}
