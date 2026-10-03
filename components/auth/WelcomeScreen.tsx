'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { AuthButton } from './AuthShell';
import { HydrationGate } from '@/components/HydrationGate';
import { useToast } from '@/components/Toast';
import { apiError, apiGet, apiPost } from '@/lib/api-client';

const OPTIONS: { value: string; label: string; text: string; icon: LucideIcon; tile: string; recommended?: boolean }[] = [
    { value: 'both', label: 'Income and spending', text: 'See what comes in, what goes out, and what you save.', icon: ArrowLeftRight, tile: 't-income', recommended: true },
    { value: 'expenses', label: 'Just my spending', text: 'Track where the money goes, with cards and cash.', icon: TrendingDown, tile: 't-expense' },
    { value: 'income', label: 'Just my income', text: 'Keep a record of what you earn and where it lands.', icon: TrendingUp, tile: 't-bank' },
];

/** Shown right after registration: the user picks what to track, then continues to the app */
export function WelcomeScreen() {
    const toast = useToast();
    const [name, setName] = useState('');

    useEffect(() => {
        apiGet<{ name?: string }>('/api/user').then(result => {
            if (!result.ok) {
                // Not logged in: the welcome step only makes sense right after registering
                window.location.replace('/login');
                return;
            }
            setName(result.data.name ?? '');
        });
    }, []);

    async function choose(option: string) {
        const result = await apiPost('/api/set-tracking-option', { trackingOption: option });
        if (result.ok) {
            window.location.assign('/setup');
        } else {
            toast('error', apiError(result.data, 'Could not save your tracking option. Please try again.'));
        }
    }

    return (
        <div id="welcome-section" className="auth-card">
            <div className="auth-head">
                <span className="auth-step">Account created</span>
                <h1>Welcome{name ? <>, <span id="user-name">{name}</span></> : null}</h1>
                <p>What would you like to track? You can change this later.</p>
            </div>
            <HydrationGate>
                <div className="choice-list">
                    {OPTIONS.map(option => {
                        const Icon = option.icon;
                        return (
                            <AuthButton
                                key={option.value}
                                action="setTrackingOption"
                                data-option={option.value}
                                className={`choice${option.recommended ? ' recommended' : ''}`}
                                onClick={() => choose(option.value)}
                            >
                                <span className={`icon-tile ${option.tile}`} aria-hidden="true"><Icon /></span>
                                <span>
                                    <b>{option.label}{option.recommended ? <span className="tag">Recommended</span> : null}</b>
                                    <small>{option.text}</small>
                                </span>
                                <ChevronRight className="chev" aria-hidden="true" />
                            </AuthButton>
                        );
                    })}
                </div>
            </HydrationGate>
        </div>
    );
}
