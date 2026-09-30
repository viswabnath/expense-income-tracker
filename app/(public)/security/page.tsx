import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { ResourcePage } from '@/components/ResourcePage';

export const metadata: Metadata = { title: 'Security Policy - BalanceTrack' };

export default function SecurityPage() {
    return (
        <ResourcePage icon={ShieldCheck} title="Security Policy" subtitle="Last Updated: April 2026">
            <h2>Data Protection</h2>
            <p>
                At BalanceTrack, security is our top priority. We implement industry-standard encryption protocols to ensure that
                your financial data remains private and protected at all times.
            </p>
            <h2>Security Measures</h2>
            <ul>
                <li><strong>End-to-End Encryption:</strong> All sensitive data is encrypted before being stored in our secure database.</li>
                <li><strong>Session Management:</strong> We use secure, HTTP-only cookies and automatic session timeouts to prevent unauthorized access.</li>
                <li><strong>Audit Logging:</strong> Every action taken in the app is logged in your personal Activity Feed, allowing for full transparency of account changes.</li>
            </ul>
            <h2>Vulnerability Management</h2>
            <p>
                We regularly audit our codebase and dependencies to identify and patch potential security gaps. Our integration with
                Supabase provides enterprise-grade database security and row-level protection.
            </p>
        </ResourcePage>
    );
}
