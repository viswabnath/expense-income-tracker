'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Search, UserPlus } from 'lucide-react';
import { AuthButton, AuthShell, HelpedInput } from './AuthShell';
import { useToast } from '@/components/Toast';
import { apiError, apiPost } from '@/lib/api-client';
import { isValidUsername, requireValue } from '@/lib/auth-validation';

/** Set by the forgot-username screen so the login form opens with the username filled in */
export const PREFILL_USERNAME_KEY = 'balancetrack:prefill-username';

export function LoginForm() {
    const router = useRouter();
    const toast = useToast();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        const prefill = sessionStorage.getItem(PREFILL_USERNAME_KEY);
        if (prefill) {
            sessionStorage.removeItem(PREFILL_USERNAME_KEY);
            setUsername(prefill);
        }
    }, []);

    async function login() {
        try {
            const name = requireValue(username, 'Username');
            const secret = requireValue(password, 'Password');
            if (!isValidUsername(name)) {
                throw new Error('Invalid username format. Username can only contain letters, numbers, and underscores');
            }
            const result = await apiPost<{ success?: boolean }>('/api/login', { username: name, password: secret });
            if (result.data.success) {
                window.location.assign('/setup');
            } else {
                toast('error', apiError(result.data, 'Login failed'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Login failed');
        }
    }

    return (
        <AuthShell>
            <div id="login-form" className="auth-form">
                <h3>Login to Your Account</h3>
                <div className="form-group">
                    <HelpedInput
                        id="login-username"
                        type="text"
                        required
                        placeholder="Enter your username (e.g., john_doe)"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        help="Username: letters, numbers, and underscores only"
                    />
                </div>
                <div className="form-group">
                    <div className="password-container">
                        <input
                            id="login-password"
                            type="password"
                            required
                            placeholder="Enter your password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                        />
                    </div>
                </div>
                <AuthButton action="login" icon={Lock} onClick={login}>Login</AuthButton>
                <AuthButton action="showRegister" icon={UserPlus} className="secondary-button" onClick={() => router.push('/register')}>
                    Register
                </AuthButton>
                <AuthButton action="showForgotUsername" icon={Search} className="info-button" onClick={() => router.push('/forgot-username')}>
                    Forgot Username?
                </AuthButton>
                <AuthButton action="showForgotPassword" icon={KeyRound} className="warning-button" onClick={() => router.push('/forgot-password')}>
                    Forgot Password?
                </AuthButton>
            </div>
        </AuthShell>
    );
}
