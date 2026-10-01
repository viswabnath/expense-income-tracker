/**
 * Display formatting shared by the ported screens. Matches the legacy output exactly:
 * rupee sign, Indian digit grouping (5,00,000.00) and two decimals.
 */
export function formatRupees(value: string | number | null | undefined): string {
    const amount = typeof value === 'number' ? value : parseFloat(value ?? '0');
    const safe = Number.isFinite(amount) ? amount : 0;
    return `₹${safe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
