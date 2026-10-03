import Link from 'next/link';
import { FEATURES } from './content';
import { Logo } from './Logo';

/** The website footer: product, company and legal links */
export function MarketingFooter() {
    return (
        <footer className="site-footer">
            <div className="wrap footer-grid">
                <div className="footer-brand">
                    <Logo />
                    <p>
                        The complete, private record of your family&apos;s money, made for India. Free for everyone,
                        with no ads and no selling your data.
                    </p>
                </div>

                <nav className="footer-col" aria-label="Features">
                    <h2>Features</h2>
                    <ul>
                        {FEATURES.slice(0, 7).map(feature => (
                            <li key={feature.slug}><Link href={`/features/${feature.slug}`}>{feature.name}</Link></li>
                        ))}
                        <li><Link href="/features">All features</Link></li>
                    </ul>
                </nav>

                <nav className="footer-col" aria-label="FinDB">
                    <h2>FinDB</h2>
                    <ul>
                        <li><Link href="/about">About</Link></li>
                        <li><Link href="/roadmap">Roadmap</Link></li>
                        <li><Link href="/download">Get the app</Link></li>
                        <li><Link href="/faq">Questions</Link></li>
                        <li><a href="/login">Log in</a></li>
                    </ul>
                </nav>

                <nav className="footer-col" aria-label="Trust and legal">
                    <h2>Trust</h2>
                    <ul>
                        <li><Link href="/security">Security</Link></li>
                        <li><Link href="/privacy">Privacy</Link></li>
                        <li><Link href="/terms">Terms</Link></li>
                    </ul>
                </nav>
            </div>

            <div className="wrap footer-bottom">
                <p>&copy; 2026 FinDB. Made in India by Team OneMark.</p>
                <p className="footer-note">
                    FinDB shows information, not financial advice. It never moves money and never connects to your
                    bank on its own.
                </p>
            </div>
        </footer>
    );
}
