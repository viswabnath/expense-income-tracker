import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import { SiteHeader } from '@/components/site/SiteHeader';
import { MarketingFooter } from '@/components/site/MarketingFooter';
import { SITE_URL } from '@/lib/site-url';
import './site.css';

// Self-hosted at build time, so the page CSP's font-src 'self' is enough
const display = Fraunces({ subsets: ['latin'], axes: ['opsz', 'SOFT'], variable: '--font-display' });
const body = Source_Sans_3({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: 'FinDB: your family\'s money, in one honest picture', template: '%s | FinDB' },
    description:
        'FinDB is a free personal finance dashboard made for India. Track bank accounts, cards, cash, loans, gold, property and savings in plain language. No ads, and your data is never sold.',
    applicationName: 'FinDB',
    appleWebApp: { capable: true, title: 'FinDB', statusBarStyle: 'default' },
    openGraph: { type: 'website', siteName: 'FinDB', locale: 'en_IN' },
    twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
        { media: '(prefers-color-scheme: dark)', color: '#0d0f22' },
    ],
};

/**
 * The root layout of the website (home, features, security, roadmap and the other public pages).
 * The app has its own root layout in app/(product), so the two stylesheets never mix.
 * Reading the request headers renders every page per request, with a fresh CSP nonce (proxy.ts).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
    await headers();
    const signedIn = (await cookies()).has('sessionId');
    return (
        <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
            <body className="site">
                <a className="skip-link" href="#main">Skip to content</a>
                <SiteHeader signedIn={signedIn} />
                <main id="main">{children}</main>
                <MarketingFooter />
            </body>
        </html>
    );
}
