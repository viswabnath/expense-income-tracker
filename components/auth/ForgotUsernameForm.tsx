'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton, AuthShell, type AuthMessage } from './AuthShell';
import { PREFILL_USERNAME_KEY } from './LoginForm';
import { useToast } from '@/components/Toast';
import { apiError, apiPost } from '@/lib/api-client';
import { isValidEmail, requireValue, securityQuestionText } from '@/lib/auth-validation';

/**
 * Two steps: the email, then the answer to the account's security question. The API shows a
 * question for any email, so this screen cannot be used to find out who has an account.
 */
export function ForgotUsernameForm() {
    const router = useRouter();
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [question, setQuestion] = useState<string | null>(null);
    const [answer, setAnswer] = useState('');
    const [message, setMessage] = useState<AuthMessage | null>(null);

    async function showQuestion() {
        try {
            const value = requireValue(email, 'Email');
            if (!isValidEmail(value)) {
                throw new Error('Please enter a valid email address');
            }
            const result = await apiPost<{ success?: boolean; securityQuestion?: string }>('/api/forgot-username', { email: value });
            if (result.data.success && result.data.securityQuestion) {
                setEmail(value);
                setQuestion(securityQuestionText(result.data.securityQuestion));
            } else {
                toast('error', apiError(result.data, 'Failed to retrieve username'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to retrieve username');
        }
    }

    async function findUsername() {
        try {
            const securityAnswer = requireValue(answer, 'Security Answer');
            const result = await apiPost<{ success?: boolean; username?: string }>('/api/forgot-username', { email, securityAnswer });
            if (result.data.success && result.data.username) {
                const username = result.data.username;
                const text = `Username found: ${username}`;
                setMessage({ kind: 'success', text });
                toast('success', text);
                // Like the legacy app: return to login with the username filled in
                setTimeout(() => {
                    sessionStorage.setItem(PREFILL_USERNAME_KEY, username);
                    router.push('/login');
                }, 2000);
            } else {
                const text = apiError(result.data, 'Failed to retrieve username');
                setMessage({ kind: 'error', text });
                toast('error', text);
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to retrieve username');
        }
    }

    const backToLogin = (
        <AuthButton action="showLogin" className="secondary-button" onClick={() => router.push('/login')}>Back to Login</AuthButton>
    );

    return (
        <AuthShell message={message}>
            {question === null ? (
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
                    <AuthButton action="forgotUsername" onClick={showQuestion}>Continue</AuthButton>
                    {backToLogin}
                </div>
            ) : (
                <div id="forgot-username-answer-form" className="auth-form">
                    <h3>Find Your Username</h3>
                    <p><strong>Security Question</strong> <span id="forgot-username-question">{question}</span></p>
                    <div className="form-group">
                        <label htmlFor="forgot-username-answer">Security Answer</label>
                        <input
                            id="forgot-username-answer"
                            type="text"
                            required
                            placeholder="Enter your security answer"
                            value={answer}
                            onChange={event => setAnswer(event.target.value)}
                        />
                    </div>
                    <AuthButton action="verifyUsernameRecovery" onClick={findUsername}>Find Username</AuthButton>
                    {backToLogin}
                </div>
            )}
        </AuthShell>
    );
}
