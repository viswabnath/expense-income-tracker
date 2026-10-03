import type { Metadata } from 'next';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import { LogoMark } from '@/components/site/Logo';
import './(site)/site.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });
const body = Source_Sans_3({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
    title: 'Page not found | FinDB',
    description: 'This page does not exist.',
};

/**
 * The 404 page for addresses that match no route at all. The app has two root layouts (the
 * website and the app), so there is no single layout to build it from; this page is standalone.
 */
export default function GlobalNotFound() {
    return (
        <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
            <body className="site">
                <main className="wrap not-found">
                    <a href="/" aria-label="FinDB home"><LogoMark size={44} /></a>
                    <span className="big">404</span>
                    <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>This page does not exist.</h1>
                    <p className="lede">It may have moved, or the link may be mistyped.</p>
                    <a className="btn btn-primary" href="/">Go to the home page</a>
                </main>
            </body>
        </html>
    );
}
