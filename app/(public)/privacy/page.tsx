import type { Metadata } from 'next';
import { Eye } from 'lucide-react';
import { ResourcePage } from '@/components/ResourcePage';

export const metadata: Metadata = { title: 'Privacy Guide - BalanceTrack' };

export default function PrivacyPage() {
    return (
        <ResourcePage icon={Eye} title="Privacy Guide" subtitle="Your data, your control">
            <h2>Privacy First</h2>
            <p>
                We believe in total transparency regarding your data. BalanceTrack only collects the information necessary to
                provide you with accurate financial tracking services.
            </p>
            <h2>Information We Collect</h2>
            <ul>
                <li><strong>Account Credentials:</strong> Securely hashed usernames and passwords.</li>
                <li><strong>Financial Records:</strong> Transactions and account balances added by you.</li>
                <li><strong>System Logs:</strong> Basic interaction data to improve app performance.</li>
            </ul>
            <h2>Data Sharing</h2>
            <p>
                We never sell your data to third parties. Your financial information is strictly for your personal use within the
                BalanceTrack ecosystem.
            </p>
        </ResourcePage>
    );
}
