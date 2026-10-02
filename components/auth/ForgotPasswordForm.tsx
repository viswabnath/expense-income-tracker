'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton, AuthShell, HelpedInput, type AuthMessage } from './AuthShell';
import { useToast } from '@/components/Toast';
import { apiError, apiPost } from '@/lib/api-client';
import { isValidEmail, isValidUsername, passwordProblem, requireValue, securityQuestionText } from '@/lib/auth-validation';

interface ResetTarget {
    /** { username } or { email }, sent again with the answer */
    account: { username: string } | { email: string };
    question: string;
}

/**
 * Two steps, as in the legacy app: the username or email, then the security question. The API
 * shows a question for any username or email, so this screen does not reveal who has an account.
 */
export function ForgotPasswordForm() {
    const router = useRouter();
    const toast = useToast();
    const [identifier, setIdentifier] = useState('');
    const [target, setTarget] = useState<ResetTarget | null>(null);
    const [answer, setAnswer] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<AuthMessage | null>(null);

    async function requestReset() {
        try {
            const input = requireValue(identifier, 'Username or Email');
            const isEmail = isValidEmail(input);
            if (!isEmail && !isValidUsername(input)) {
                throw new Error('Please enter a valid username (letters, numbers, underscore only) or a valid email address');
            }
            const account = isEmail ? { email: input } : { username: input };
            const result = await apiPost<{ success?: boolean; securityQuestion?: string }>('/api/forgot-password', account);
            if (result.data.success && result.data.securityQuestion) {
                setTarget({ account, question: securityQuestionText(result.data.securityQuestion) });
                setMessage(null);
            } else {
                toast('error', apiError(result.data, 'Error occurred. Please try again.'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Error occurred. Please try again.');
        }
    }

    async function resetPassword() {
        if (!target) return;
        try {
            const securityAnswer = requireValue(answer, 'Security Answer');
            const password = requireValue(newPassword, 'New Password');
            const confirm = requireValue(confirmPassword, 'Confirm Password');
            const problem = passwordProblem(password);
            if (problem) {
                throw new Error(problem);
            }
            if (password !== confirm) {
                throw new Error('Passwords do not match');
            }
            const result = await apiPost<{ success?: boolean }>('/api/reset-password', {
                ...target.account,
                securityAnswer,
                newPassword: password,
            });
            if (result.data.success) {
                const text = 'Password reset successfully! You can now login with your new password.';
                setMessage({ kind: 'success', text });
                toast('success', text);
                setTimeout(() => router.push('/login'), 2000);
            } else {
                const text = apiError(result.data, 'Error occurred. Please try again.');
                setMessage({ kind: 'error', text });
                toast('error', text);
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Error occurred. Please try again.');
        }
    }

    const backToLogin = (
        <AuthButton action="showLogin" className="secondary-button" onClick={() => router.push('/login')}>Back to Login</AuthButton>
    );

    return (
        <AuthShell message={message}>
            {target === null ? (
                <div id="forgot-password-form" className="auth-form">
                    <h3>Reset Your Password</h3>
                    <p>Enter your username or email address to reset your password</p>
                    <div className="form-group">
                        <HelpedInput
                            id="forgot-username-email"
                            type="text"
                            required
                            placeholder="Enter username or email"
                            value={identifier}
                            onChange={event => setIdentifier(event.target.value)}
                            help={<>Username: letters, numbers, and underscores only<br />Email: valid email address format</>}
                        />
                    </div>
                    <AuthButton action="requestPasswordReset" onClick={requestReset}>Continue</AuthButton>
                    {backToLogin}
                </div>
            ) : (
                <div id="reset-password-form" className="auth-form">
                    <h3>Create New Password</h3>
                    <p><strong>Security Question</strong> <span id="reset-security-question">{target.question}</span></p>
                    <div className="form-group">
                        <label htmlFor="reset-security-answer">Security Answer</label>
                        <input
                            id="reset-security-answer"
                            type="text"
                            required
                            placeholder="Enter your security answer"
                            value={answer}
                            onChange={event => setAnswer(event.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reset-new-password">New Password</label>
                        <div className="password-container">
                            <HelpedInput
                                id="reset-new-password"
                                type="password"
                                required
                                placeholder="Create a new password"
                                value={newPassword}
                                onChange={event => setNewPassword(event.target.value)}
                                help="8-16 characters with at least one uppercase, one lowercase, one number, and one special character (_, -, @, :, or &)"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="reset-confirm-password">Confirm New Password</label>
                        <div className="password-container">
                            <input
                                id="reset-confirm-password"
                                type="password"
                                required
                                placeholder="Confirm your new password"
                                value={confirmPassword}
                                onChange={event => setConfirmPassword(event.target.value)}
                            />
                        </div>
                    </div>
                    <AuthButton action="resetPassword" onClick={resetPassword}>Reset Password</AuthButton>
                    {backToLogin}
                </div>
            )}
        </AuthShell>
    );
}
