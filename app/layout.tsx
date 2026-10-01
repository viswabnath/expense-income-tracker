import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/Toast';
// Shared with the legacy app until the redesign, so ported pages look the same
import '../legacy/public/css/fintech-theme.css';

// Self-hosted at build time (no request to Google at runtime, so CSP font-src 'self' is enough)
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

export const metadata = {
    title: 'BalanceTrack',
    description: 'Track your expenses and income',
};

/**
 * Every page renders per request: each response carries a fresh CSP nonce (see proxy.ts),
 * and reading the request headers opts into dynamic rendering.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
    await headers();
    return (
        <html lang="en">
            <body className={inter.className}>
                <ToastProvider>{children}</ToastProvider>
            </body>
        </html>
    );
}
