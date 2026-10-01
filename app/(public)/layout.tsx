import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { ToastProvider } from '@/components/Toast';
// Shared with the legacy app until the redesign, so ported pages look the same
import '../../legacy/public/css/fintech-theme.css';

// Self-hosted at build time (no request to Google at runtime, so CSP font-src 'self' is enough)
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

/**
 * Public pages (no login). They render per request because each response carries a
 * fresh CSP nonce (see proxy.ts); reading the request headers opts into that.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
    await headers();
    return (
        <div className={inter.className}>
            <ToastProvider>
                <div className="container">{children}</div>
                <SiteFooter />
            </ToastProvider>
        </div>
    );
}
