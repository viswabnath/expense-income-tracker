'use client';

import { useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';

/** The browser's install prompt event (Chrome, Edge and Samsung Internet; not yet in TypeScript's DOM types) */
interface InstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Install FinDB": shown only where the browser offers to install the web app (it fires
 * beforeinstallprompt). Elsewhere, such as Safari on iPhone, the written steps on the page apply.
 */
export function InstallButton() {
    const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
        const onPrompt = (event: Event) => {
            event.preventDefault();
            setPrompt(event as InstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setPrompt(null);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (installed) {
        return <span className="btn btn-ghost" aria-live="polite"><Check size={18} /> FinDB is installed</span>;
    }
    if (!prompt) return null;
    return (
        <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
                await prompt.prompt();
                const { outcome } = await prompt.userChoice;
                if (outcome === 'accepted') setInstalled(true);
                setPrompt(null);
            }}
        >
            <Download size={18} /> Install FinDB
        </button>
    );
}
