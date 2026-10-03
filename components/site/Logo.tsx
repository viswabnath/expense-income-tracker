/**
 * The FinDB mark (concept B, "Ledger F", chosen on 2026-10-03): an F whose two bars are the same
 * length, because what goes in equals what goes out, and a gold block on the bottom line. Colours
 * come from CSS custom properties (--logo-tile, --logo-glyph, --logo-word, --logo-gold), so it works
 * in light and dark themes. scripts/generate-icons.js draws the same mark for the app icons.
 */

export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
            <rect width="64" height="64" rx="15" fill="var(--logo-tile)" />
            <path d="M21 50 V15 H44 M21 31 H44" fill="none" stroke="var(--logo-glyph)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="37" y="41" width="9" height="9" rx="1.5" fill="var(--logo-gold)" />
        </svg>
    );
}

/** The wordmark "FinDB": the F's bars are equal in length, and the dot of the i is gold */
export function LogoWord({ height = 22 }: { height?: number }) {
    return (
        <svg height={height} width={(height * 138) / 48} viewBox="-4 0 138 48" aria-hidden="true">
            <g fill="none" stroke="var(--logo-word)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 44 V4 H24 M4 23 H24" />
                <path d="M34 20 V44" />
                <path d="M44 44 V20 M44 28 A8 8 0 0 1 60 28 V44" />
                <path d="M72 4 V44 M72 4 H80 A20 20 0 0 1 80 44 H72" />
                <path d="M110 4 V44 M110 4 H120 A9 9 0 0 1 120 22 H110 M110 22 H122 A11 11 0 0 1 122 44 H110" />
            </g>
            <rect x="31" y="7" width="6" height="6" transform="rotate(45 34 10)" fill="var(--logo-gold)" />
        </svg>
    );
}

/** Mark and wordmark together, as the home link */
export function Logo() {
    return (
        <span className="logo">
            <LogoMark size={34} />
            <LogoWord height={22} />
            <span className="sr-only">FinDB</span>
        </span>
    );
}
