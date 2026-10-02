import Link from 'next/link';
import { Heart, LayoutDashboard } from 'lucide-react';

/**
 * Same markup and classes as the former single-page app's footer, so the shared
 * fintech-theme.css styles it identically. Quick links go to the app's screens; proxy.ts
 * sends logged-out visitors to /login.
 */
export function SiteFooter() {
    return (
        <footer className="app-footer">
            <div className="footer-container">
                <div className="footer-grid">
                    <div className="footer-col footer-about">
                        <div className="footer-brand">
                            <LayoutDashboard />
                            <span>FinDB</span>
                        </div>
                        <p>
                            Professional financial tracking designed for simplicity and precision. Manage your wealth,
                            track expenses, and monitor income with industry-standard security.
                        </p>
                    </div>

                    <div className="footer-col">
                        <h4>Quick Links</h4>
                        <ul className="footer-links">
                            <li><a href="/setup">Account Setup</a></li>
                            <li><a href="/transactions">Transactions</a></li>
                            <li><a href="/summary">Monthly Summary</a></li>
                            <li><a href="/activity">Activity Log</a></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <h4>Resources</h4>
                        <ul className="footer-links">
                            <li><Link href="/about">About OneMark</Link></li>
                            <li><Link href="/security">Security Policy</Link></li>
                            <li><Link href="/privacy">Privacy Guide</Link></li>
                            <li><Link href="/terms">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <h4>Contact Support</h4>
                        <ul className="footer-links">
                            <li><a href="mailto:support@onemark.co.in">support@onemark.co.in</a></li>
                            <li><a href="https://onemark.co.in/contact" target="_blank" rel="noopener noreferrer">Contact Form</a></li>
                            <li><a href="#">Help Center</a></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <div className="copyright">&copy; 2026 FinDB. All rights reserved.</div>
                    <div className="footer-credits">
                        Crafted with <Heart className="icon-danger" /> by{' '}
                        <a href="https://onemark.co.in" target="_blank" rel="noopener noreferrer">Team OneMark</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
