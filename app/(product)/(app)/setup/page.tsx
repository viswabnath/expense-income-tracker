import type { Metadata } from 'next';
import { SetupScreen } from '@/components/setup/SetupScreen';

export const metadata: Metadata = { title: 'Account Setup - FinDB' };

export default function SetupPage() {
    return <SetupScreen />;
}
