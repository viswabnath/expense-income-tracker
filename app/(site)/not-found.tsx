import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Shown inside the website when a page asks for something that does not exist (an unknown feature) */
export default function SiteNotFound() {
    return (
        <section className="wrap not-found">
            <span className="big">404</span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>This page does not exist.</h1>
            <p className="lede">It may have moved, or the link may be mistyped.</p>
            <Link className="btn btn-primary" href="/">Go to the home page <ArrowRight size={18} /></Link>
        </section>
    );
}
