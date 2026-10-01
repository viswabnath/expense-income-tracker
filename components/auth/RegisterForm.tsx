'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AuthButton, AuthShell, HelpedInput } from './AuthShell';
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
                // Registration also logs the user in; next they choose what to track
                router.push('/welcome');
            } else {
                toast('error', apiError(result.data, 'Registration failed'));
            }
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Registration failed');
        }
    }

    return (
        <AuthShell>
            <div id="register-form" className="auth-form">
                <h3>Create New Account</h3>
                <div className="form-group">
                    <input id="register-name" type="text" required placeholder="Enter your full name" {...field('name')} />
                </div>
                <div className="form-group">
                    <HelpedInput
                        id="register-username"
                        type="text"
                        required
                        placeholder="Choose a username"
                        help="Username: letters, numbers, and underscores only"
                        {...field('username')}
                    />
                </div>
                <div className="form-group">
                    <input id="register-email" type="email" required placeholder="Enter your email address" {...field('email')} />
                </div>
                <div className="form-group">
                    <div className="password-container">
                        <HelpedInput
                            id="register-password"
                            type="password"
                            required
                            placeholder="Create a strong password"
                            help="8-16 characters with at least one uppercase, one lowercase, one number, and one special character (_, -, &, @, :, or &)"
                            {...field('password')}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <div className="password-container">
                        <input
                            id="register-confirm-password"
                            type="password"
                            required
                            placeholder="Confirm your password"
                            {...field('confirmPassword')}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <select id="register-security-question" required {...field('securityQuestion')}>
                        <option value="">Select a security question</option>
                        {SECURITY_QUESTIONS.map(question => (
                            <option key={question.value} value={question.value}>{question.label}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <input id="register-security-answer" type="text" required placeholder="Enter your answer" {...field('securityAnswer')} />
                </div>
                <AuthButton action="register" icon={Sparkles} onClick={register}>Create Account</AuthButton>
                <AuthButton action="showLogin" icon={ArrowLeft} className="secondary-button" onClick={() => router.push('/login')}>
                    Back to Login
                </AuthButton>
            </div>
        </AuthShell>
    );
}
