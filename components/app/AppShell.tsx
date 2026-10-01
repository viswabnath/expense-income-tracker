'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, CreditCard, ListTodo, Loader2, LogOut, Settings, X, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { apiPost, onActiveRequestsChange } from '@/lib/api-client';

interface NavItem {
    section: string;
    label: string;
    icon: LucideIcon;
    href: string;
}

/**
 * Setup and Transactions live in Next.js; the other screens are still in the legacy app, which opens the
 * requested one from ?section=. All links are full page loads so each screen fetches fresh data.
 */
const NAV_ITEMS: NavItem[] = [
    { section: 'setup', label: 'Setup', icon: Settings, href: '/setup' },
    { section: 'transactions', label: 'Transactions', icon: CreditCard, href: '/transactions' },
    { section: 'summary', label: 'Summary', icon: BarChart3, href: '/?section=summary' },
    { section: 'activity', label: 'Activity', icon: ListTodo, href: '/?section=activity' },
];

/** The legacy logged-in frame: nav bar, mobile sidebar, logout confirmation and the loading overlay */
export function AppShell({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    // The legacy CSS slides the sidebar in when body has "sidebar-open"
    useEffect(() => {
        document.body.classList.toggle('sidebar-open', sidebarOpen);
        document.body.style.overflow = sidebarOpen ? 'hidden' : 'auto';
    }, [sidebarOpen]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // Same timing as the legacy loader: show while requests run, hide shortly after the last one
    useEffect(() => {
        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        return onActiveRequestsChange(active => {
            clearTimeout(hideTimer);
            if (active > 0) setBusy(true);
            else hideTimer = setTimeout(() => setBusy(false), 100);
        });
    }, []);

    async function logout() {
        // Like the legacy app: go to login even if the request fails
        await apiPost('/api/logout', {}).catch(() => undefined);
        window.location.assign('/login');
    }

    const openLogout = (event: React.MouseEvent) => {
        event.preventDefault();
        setSidebarOpen(false);
        setLogoutOpen(true);
    };

    return (
        <>
            <div className="container">
                <div id="main-app">
                    <div id="nav-bar" style={{ display: 'flex' }}>
                        <div className="nav-mobile">
                            <button type="button" className="hamburger-button" data-action="toggleSidebar" aria-label="Menu" onClick={() => setSidebarOpen(open => !open)}>
                                <div className="hamburger-icon"><span></span><span></span><span></span></div>
                            </button>
                        </div>
                        <div className="nav-brand">
                            <h1><a href="/setup" data-action="showSection" data-section="setup" style={{ color: 'inherit', textDecoration: 'none' }}>BalanceTrack</a></h1>
                        </div>
                        <div className="nav-desktop">
                            {NAV_ITEMS.map(({ section, label, icon: Icon, href }) => (
                                <a key={section} href={href} className="nav-link" data-action="showSection" data-section={section}>
                                    <span><Icon /></span>{label}
                                </a>
                            ))}
                            <a href="#" className="nav-link logout-link" data-action="logout" onClick={openLogout}>
                                <span><LogOut /></span>Logout
                            </a>
                        </div>
                    </div>

                    <div id="mobile-sidebar">
                        <div className="mobile-brand">
                            <h1><a href="/setup" style={{ color: 'inherit', textDecoration: 'none' }}>BalanceTrack</a></h1>
                        </div>
                        {NAV_ITEMS.map(({ section, label, icon: Icon, href }) => (
                            <a key={section} href={href} data-action="showSection" data-section={section} data-close-sidebar="true">
                                <span className="icon-enhanced"><Icon /></span>{label}
                            </a>
                        ))}
                        <a href="#" className="logout-link" data-action="logout" data-close-sidebar="true" onClick={openLogout}>
                            <span className="icon-enhanced"><LogOut /></span>Logout
                        </a>
                    </div>
                    <div id="sidebar-overlay" data-action="closeSidebar" onClick={() => setSidebarOpen(false)}></div>

                    {children}
                </div>
            </div>

            <Modal
                id="logout-confirmation-modal"
                title="Confirm Logout"
                open={logoutOpen}
                small
                closeAction="close-logout-confirmation"
                onClose={() => setLogoutOpen(false)}
                footer={(
                    <>
                        <button type="button" data-action="confirm-logout" className="danger-button" onClick={logout}>
                            <span className="icon-enhanced"><LogOut /></span>Logout
                        </button>
                        <button type="button" data-action="close-logout-confirmation" className="secondary-button" onClick={() => setLogoutOpen(false)}>
                            <span className="icon-enhanced"><X /></span>Cancel
                        </button>
                    </>
                )}
            >
                <p id="logout-confirmation-message">Are you sure you want to log out?</p>
                <p className="info-text">You will need to log in again to access your account.</p>
            </Modal>

            <div id="global-loader" className={`loader-overlay${busy ? '' : ' hidden'}`}>
                <div className="loader-content">
                    <div className="loader-spinner-box"><Loader2 /></div>
                    <div className="loader-text">Processing...</div>
                </div>
            </div>
        </>
    );
}
