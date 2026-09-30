import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ResourcePageProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    children: ReactNode;
}

/** The legacy "resource page" layout: icon, title and subtitle header, then prose. */
export function ResourcePage({ icon: Icon, title, subtitle, children }: ResourcePageProps) {
    return (
        <div className="resource-page">
            <div className="resource-header">
                <Icon />
                <h1>{title}</h1>
                <p className="last-updated">{subtitle}</p>
            </div>
            <div className="resource-body">{children}</div>
        </div>
    );
}
