'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton, AuthShell, type AuthMessage } from './AuthShell';
import { PREFILL_USERNAME_KEY } from './LoginForm';
import { useToast } from '@/components/Toast';
import { apiError, apiPost } from '@/lib/api-client';
import { isValidEmail, requireValue } from '@/lib/auth-validation';

export function ForgotUsernameForm() {
    const router = useRouter();
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<AuthMessage | null>(null);

    async function findUsername() {
        try {
            const value = requireValue(email, 'Email');
            if (!isValidEmail(value)) {
                throw new Error('Please enter a valid email address');
            }
            const result = await apiPost<{ success?: boolean; username?: string; name?: string }>('/api/forgot-username', { email: value });
            if (result.data.success && result.data.username) {
                const text = `Username found: ${result.data.username} (${result.data.name ?? ''})`;
                setMessage({ kind: 'success', text });
                toast('success', text);
                // Like the legacy app: return to login with the username filled in
                const username = result.data.username;
                setTimeout(() => {
                    sessionStorage.setItem(PREFILL_USERNAME_KEY, username);
                    router.push('/login');
                }, 2000);
            } else {
                toast('error', apiError(result.data, 'Failed to retrieve username'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to retrieve username');
        }
    }

    return (
        <AuthShell message={message}>
            <div id="forgot-username-form" className="auth-form">
                <h3>Find Your Username</h3>
                <p>Enter your email address to retrieve your username</p>
                <div className="form-group">
                    <input
                        id="forgot-username-email-input"
                        type="email"
                        required
                        placeholder="Enter your email address"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                    />
                </div>
                <AuthButton action="forgotUsername" onClick={findUsername}>Find Username</AuthButton>
                <AuthButton action="showLogin" className="secondary-button" onClick={() => router.push('/login')}>Back to Login</AuthButton>
            </div>
        </AuthShell>
    );
}
