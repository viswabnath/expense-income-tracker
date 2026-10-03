/**
 * The FinDB mark (concept A, "Balance coin"): a lowercase d and b sharing one stem, forming a coin
 * split into two equal halves, with a gold point above. Colours come from CSS custom properties
 * (--logo-tile, --logo-glyph, --logo-word, --logo-gold) so it works in light and dark themes.
 */

export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
            <rect width="64" height="64" rx="15" fill="var(--logo-tile)" />
            <circle cx="32" cy="38" r="12" fill="none" stroke="var(--logo-glyph)" strokeWidth="5" />
            <line x1="32" y1="21" x2="32" y2="50" stroke="var(--logo-glyph)" strokeWidth="5" strokeLinecap="round" />
            <rect x="28" y="7" width="8" height="8" transform="rotate(45 32 11)" fill="var(--logo-gold)" />
        </svg>
    );
}

/** The lowercase wordmark: the d and b mirror each other, and the dot of the i is gold */
export function LogoWord({ height = 22 }: { height?: number }) {
    return (
        <svg height={height} width={(height * 120) / 48} viewBox="-5 0 120 48" aria-hidden="true">
            <g fill="none" stroke="var(--logo-word)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 44 V14 A10 10 0 0 1 18 4" />
                <path d="M1 22 H16" />
                <path d="M26 22 V44" />
                <path d="M36 44 V22 M36 30 A8 8 0 0 1 52 30 V44" />
                <circle cx="69" cy="33" r="11" />
                <path d="M80 4 V44" />
                <path d="M88 4 V44" />
                <circle cx="99" cy="33" r="11" />
            </g>
            <rect x="23" y="7" width="6" height="6" transform="rotate(45 26 10)" fill="var(--logo-gold)" />
        </svg>
    );
}

/** Mark and wordmark together, as the site's home link */
export function Logo() {
    return (
        <span className="logo">
            <LogoMark size={34} />
            <LogoWord height={24} />
            <span className="sr-only">FinDB</span>
        </span>
    );
}
