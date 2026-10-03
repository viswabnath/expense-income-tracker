'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton, AuthForm, AuthHead, AuthShell, Field, PasswordField, PasswordRules, type AuthMessage } from './AuthShell';
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
        <p className="auth-alt">
            Remembered it?{' '}
            <AuthButton action="showLogin" className="btn-link" onClick={() => router.push('/login')}>Back to log in</AuthButton>
        </p>
    );

    return (
        <AuthShell message={message}>
            {target === null ? (
                <AuthForm id="forgot-password-form" onSubmit={requestReset}>
                    <AuthHead step="Step 1 of 2" title="Reset your password">Enter your username or the email you signed up with.</AuthHead>
                    <Field
                        id="forgot-username-email"
                        label="Username or email"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        required
                        value={identifier}
                        onChange={event => setIdentifier(event.target.value)}
                        help="A username uses letters, numbers and underscores"
                    />
                    <AuthButton action="requestPasswordReset" submit className="btn btn-primary btn-block">Continue</AuthButton>
                    {backToLogin}
                </AuthForm>
            ) : (
                <AuthForm id="reset-password-form" onSubmit={resetPassword}>
                    <AuthHead step="Step 2 of 2" title="Choose a new password">Answer your security question, then set a new password.</AuthHead>
                    <div className="question-box">
                        <small>Security question</small>
                        <span id="reset-security-question">{target.question}</span>
                    </div>
                    <div className="form-grid">
                        <Field
                            id="reset-security-answer"
                            label="Your answer"
                            type="text"
                            autoComplete="off"
                            required
                            value={answer}
                            onChange={event => setAnswer(event.target.value)}
                        />
                        <PasswordField
                            id="reset-new-password"
                            label="New password"
                            autoComplete="new-password"
                            required
                            value={newPassword}
                            onChange={event => setNewPassword(event.target.value)}
                        >
                            <PasswordRules password={newPassword} />
                        </PasswordField>
                        <PasswordField
                            id="reset-confirm-password"
                            label="Confirm new password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={event => setConfirmPassword(event.target.value)}
                        />
                    </div>
                    <AuthButton action="resetPassword" submit className="btn btn-primary btn-block">Reset password</AuthButton>
                    {backToLogin}
                </AuthForm>
            )}
        </AuthShell>
    );
}
