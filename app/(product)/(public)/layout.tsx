import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';

/** Pages that need no login: resource pages and the auth screens */
export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <div className="container">{children}</div>
            <SiteFooter />
        </>
    );
}
