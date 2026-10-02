import type { Metadata } from 'next';
import { TransactionsScreen } from '@/components/transactions/TransactionsScreen';

export const metadata: Metadata = { title: 'Transactions - FinDB' };

export default function TransactionsPage() {
    return <TransactionsScreen />;
}
