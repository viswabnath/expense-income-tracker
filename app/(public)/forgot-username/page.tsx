import type { Metadata } from 'next';
import { ForgotUsernameForm } from '@/components/auth/ForgotUsernameForm';

export const metadata: Metadata = { title: 'Find Your Username - BalanceTrack' };

export default function ForgotUsernamePage() {
    return <ForgotUsernameForm />;
}
