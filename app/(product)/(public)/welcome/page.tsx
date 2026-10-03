import type { Metadata } from 'next';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';

export const metadata: Metadata = { title: 'Welcome - FinDB' };

export default function WelcomePage() {
    return <WelcomeScreen />;
}
