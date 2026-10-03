import type { ReactNode } from 'react';
import { AppShell } from '@/components/app/AppShell';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Logged-in screens. proxy.ts sends visitors without a session cookie to /login before this
 * renders; an expired session is caught by the first API call (401) on the page.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <AppShell>{children}</AppShell>
            <SiteFooter />
        </>
    );
}
