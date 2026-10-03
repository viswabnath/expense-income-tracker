import type { ReactNode } from 'react';
import { ArrowLeft, CircleCheck, Fuel, Banknote, UtensilsCrossed } from 'lucide-react';
import { Logo } from '@/components/site/Logo';

/**
 * The sign-in screens (log in, sign up, forgotten details, and the welcome step): the form on
 * the left, and on larger screens FinDB's promises and a sample screen on the right.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="auth-screen">
            <div className="auth-panel">
                <header className="auth-top">
                    <a href="/" aria-label="FinDB home"><Logo /></a>
                    <a href="/" className="auth-back"><ArrowLeft size={16} aria-hidden="true" /> FinDB home</a>
                </header>
                <main className="auth-main">{children}</main>
                <footer className="auth-foot">
                    <nav aria-label="FinDB">
                        <a href="/security">Security</a>
                        <a href="/privacy">Privacy</a>
                        <a href="/terms">Terms</a>
                        <a href="/faq">Questions</a>
                    </nav>
                    <span>
                        &copy; 2026 FinDB. Made in India by{' '}
                        <a href="https://www.onemark.co.in" target="_blank" rel="noopener noreferrer">OneMark</a>.
                    </span>
                </footer>
            </div>

            <aside className="auth-brand" aria-label="Why FinDB">
                <h2>Track every rupee your family owns and owes.</h2>
                <ul>
                    <li><CircleCheck size={20} aria-hidden="true" /><span><b>Free for everyone.</b> No plans, no paywall, no ads.</span></li>
                    <li><CircleCheck size={20} aria-hidden="true" /><span><b>No bank passwords.</b> FinDB never asks for them and never moves money.</span></li>
                    <li><CircleCheck size={20} aria-hidden="true" /><span><b>Only you see your data.</b> It is never sold or shared.</span></li>
                </ul>
                <div className="brand-phone" aria-hidden="true">
                    <div className="brand-phone-screen">
                        <div className="bp-card">
                            <span className="bp-label">Spent in October</span>
                            <span className="bp-big">₹52,180</span>
                            <span className="bp-meter"><i /></span>
                            <span>₹7,820 left of ₹60,000</span>
                        </div>
                        <div className="bp-row"><span className="bp-dot" style={{ background: '#f97316' }}><UtensilsCrossed /></span><span><b>Swiggy</b><small>Eating out</small></span><b>-₹640</b></div>
                        <div className="bp-row"><span className="bp-dot" style={{ background: '#ef4444' }}><Fuel /></span><span><b>HP Petrol</b><small>Fuel</small></span><b>-₹2,000</b></div>
                        <div className="bp-row"><span className="bp-dot" style={{ background: '#0f8a5f' }}><Banknote /></span><span><b>Salary</b><small>Income</small></span><b className="bp-in">+₹85,000</b></div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
