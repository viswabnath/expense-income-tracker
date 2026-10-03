import type { Metadata } from 'next';
import { ForgotUsernameForm } from '@/components/auth/ForgotUsernameForm';

export const metadata: Metadata = { title: 'Find Your Username - FinDB' };

export default function ForgotUsernamePage() {
    return <ForgotUsernameForm />;
}
