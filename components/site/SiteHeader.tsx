'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

export const NAV_LINKS = [
    { href: '/features', label: 'Features' },
    { href: '/security', label: 'Security' },
    { href: '/roadmap', label: 'Roadmap' },
    { href: '/download', label: 'Get the app' },
    { href: '/faq', label: 'Questions' },
];

/**
 * The website's top bar. On phones the links fold into a menu panel. `signedIn` (from the
 * session cookie) swaps "Log in" and "Start free" for a single "Open FinDB".
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Close the menu on navigation and on Escape, and stop the page scrolling behind it
    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        document.body.classList.add('menu-open');
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.classList.remove('menu-open');
        };
    }, [open]);

    const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    return (
        <header className="site-header">
            <div className="site-header-inner">
                <Link href="/" className="home-link" aria-label="FinDB home">
                    <Logo />
                </Link>

                <nav className="site-nav" aria-label="Main">
                    {NAV_LINKS.map(link => (
                        <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="header-actions">
                    {signedIn ? (
                        <a className="btn btn-primary btn-sm" href="/setup">Open FinDB</a>
                    ) : (
                        <>
                            <a className="btn btn-ghost btn-sm hide-narrow" href="/login">Log in</a>
                            <a className="btn btn-primary btn-sm" href="/register">Start free</a>
                        </>
                    )}
                    <button
                        type="button"
                        className="menu-button"
                        aria-expanded={open}
                        aria-controls="mobile-menu"
                        aria-label={open ? 'Close menu' : 'Open menu'}
                        onClick={() => setOpen(value => !value)}
                    >
                        {open ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            <div id="mobile-menu" className="mobile-menu" data-open={open} hidden={!open}>
                <nav aria-label="Main, mobile">
                    {NAV_LINKS.map(link => (
                        <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>
                            {link.label}
                        </Link>
                    ))}
                    {!signedIn && <a href="/login">Log in</a>}
                </nav>
            </div>
        </header>
    );
}
