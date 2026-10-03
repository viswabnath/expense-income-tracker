import { Smartphone } from 'lucide-react';

/** Plain "coming soon" badges for the planned store apps (no store logos until the apps exist) */
export function StoreBadges() {
    return (
        <div className="store-badges">
            <span className="store-badge"><Smartphone size={22} aria-hidden="true" /><span><small>Coming soon</small><b>iPhone app</b></span></span>
            <span className="store-badge"><Smartphone size={22} aria-hidden="true" /><span><small>Coming soon</small><b>Android app</b></span></span>
        </div>
    );
}
