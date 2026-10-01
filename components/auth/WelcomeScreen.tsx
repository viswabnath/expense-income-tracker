'use client';

import { useEffect, useState } from 'react';
import { AuthButton } from './AuthShell';
import { useToast } from '@/components/Toast';
import { apiError, apiGet, apiPost } from '@/lib/api-client';

const OPTIONS = [
    { value: 'income', label: 'Income Only' },
    { value: 'expenses', label: 'Expenses Only' },
    { value: 'both', label: 'Both Income & Expenses' },
] as const;

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
            // The logged-in app is still the legacy app at "/"
            window.location.assign('/');
        } else {
            toast('error', apiError(result.data, 'Could not save your tracking option. Please try again.'));
        }
    }

    return (
        <div id="welcome-section">
            <h2>Welcome, <span id="user-name">{name}</span>!</h2>
            <p><em>&quot;Follow your financial goals with discipline!&quot;</em></p>
            <h3>Choose Your Tracking Option</h3>
            {OPTIONS.map(option => (
                <AuthButton key={option.value} action="setTrackingOption" data-option={option.value} onClick={() => choose(option.value)}>
                    {option.label}
                </AuthButton>
            ))}
        </div>
    );
}
