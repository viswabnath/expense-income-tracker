'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton, AuthForm, AuthHead, AuthShell, Field, PasswordField, PasswordRules } from './AuthShell';
import { useToast } from '@/components/Toast';
import { apiError, apiPost } from '@/lib/api-client';
import { SECURITY_QUESTIONS, validateRegistration, type RegistrationInput } from '@/lib/auth-validation';

const EMPTY: RegistrationInput = {
    name: '', username: '', email: '', password: '', confirmPassword: '', securityQuestion: '', securityAnswer: '',
};

export function RegisterForm() {
    const router = useRouter();
    const toast = useToast();
    const [form, setForm] = useState<RegistrationInput>(EMPTY);
    const field = (key: keyof RegistrationInput) => ({
        value: form[key],
        onChange: (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value })),
    });

    async function register() {
        try {
            const data = validateRegistration(form);
            const result = await apiPost<{ success?: boolean }>('/api/register', data);
            if (result.data.success) {
                // Registration also logs the user in; next they choose what to track. A full page
                // load, like after login: the session just changed, and a client-side push was
                // occasionally lost here (seen in the end-to-end runs)
                window.location.assign('/welcome');
            } else {
                toast('error', apiError(result.data, 'Registration failed'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Registration failed');
        }
    }

    return (
        <AuthShell>
            <AuthForm id="register-form" onSubmit={register}>
                <AuthHead title="Create your free account">It takes a minute. Nothing is connected to your bank.</AuthHead>
                <div className="form-grid">
                    <div className="form-grid two">
                        <Field id="register-name" label="Full name" type="text" autoComplete="name" required {...field('name')} />
                        <Field id="register-username" label="Username" type="text" autoComplete="username" autoCapitalize="none" required
                            help="Letters, numbers and underscores" {...field('username')} />
                    </div>
                    <Field id="register-email" label="Email" type="email" autoComplete="email" required {...field('email')} />
                    <PasswordField id="register-password" label="Password" autoComplete="new-password" required {...field('password')}>
                        <PasswordRules password={form.password} />
                    </PasswordField>
                    <PasswordField id="register-confirm-password" label="Confirm password" autoComplete="new-password" required {...field('confirmPassword')} />

                    <span className="auth-section-title">Account recovery</span>
                    <span className="auth-section-note">If you forget your username or password, you will answer this question.</span>
                    <div className="field">
                        <label htmlFor="register-security-question">Security question</label>
                        <select id="register-security-question" required {...field('securityQuestion')}>
                            <option value="">Choose a question</option>
                            {SECURITY_QUESTIONS.map(question => (
                                <option key={question.value} value={question.value}>{question.label}</option>
                            ))}
                        </select>
                    </div>
                    <Field id="register-security-answer" label="Your answer" type="text" autoComplete="off" required {...field('securityAnswer')} />
                </div>
                <AuthButton action="register" submit className="btn btn-primary btn-block">Create free account</AuthButton>
                <p className="auth-alt">
                    Already have an account?{' '}
                    <AuthButton action="showLogin" className="btn-link" onClick={() => router.push('/login')}>Log in</AuthButton>
                </p>
            </AuthForm>
        </AuthShell>
    );
}
