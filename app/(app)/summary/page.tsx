import type { Metadata } from 'next';
import { SummaryScreen } from '@/components/summary/SummaryScreen';

export const metadata: Metadata = { title: 'Monthly Summary - BalanceTrack' };

export default function SummaryPage() {
    return <SummaryScreen />;
}
