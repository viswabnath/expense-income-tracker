/**
 * Unit tests for entryDate in lib/services/transactions.ts (same rule as legacy/server.js)
 */
import { entryDate } from '../../lib/services/transactions';

describe('entryDate', () => {
    const ORIGINAL_TZ = process.env.TZ;
    afterEach(() => { process.env.TZ = ORIGINAL_TZ; });

    test.each(['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'])('keeps YYYY-MM-DD as given in %s', (zone) => {
        process.env.TZ = zone;
        expect(entryDate('2026-10-01')).toEqual({ date: '2026-10-01', month: 10, year: 2026 });
        expect(entryDate('2027-01-01')).toEqual({ date: '2027-01-01', month: 1, year: 2027 });
        expect(entryDate('2024-02-29')).toEqual({ date: '2024-02-29', month: 2, year: 2024 });
    });

    test('a full timestamp uses its UTC date', () => {
        expect(entryDate('2026-03-01T23:30:00Z')).toEqual({ date: '2026-03-01', month: 3, year: 2026 });
    });

    test.each([['2026-02-30'], ['2025-02-29'], ['2026-13-01'], ['not a date'], [''], [undefined], [20261001]])('refuses %p', (value) => {
        expect(entryDate(value)).toBeNull();
    });
});
