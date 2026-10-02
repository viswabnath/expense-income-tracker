import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { ResourcePage } from '@/components/ResourcePage';

export const metadata: Metadata = { title: 'Terms of Service - FinDB' };

export default function TermsPage() {
    return (
        <ResourcePage icon={FileText} title="Terms of Service" subtitle="Standard Usage Agreement">
            <h2>Acceptance of Terms</h2>
            <p>
                By using FinDB, you agree to comply with and be bound by the following terms and conditions of use. Please
                review these terms carefully.
            </p>
            <h2>User Responsibility</h2>
            <p>
                Users are responsible for maintaining the confidentiality of their account credentials and for all activities that
                occur under their account. FinDB is a tracking tool and does not provide professional financial advice.
            </p>
            <h2>Limitation of Liability</h2>
            <p>
                While we strive for 100% accuracy, FinDB and Team OneMark are not liable for any financial decisions made
                based on the data provided by the application. We recommend cross-verifying important data with your official bank
                statements.
            </p>
        </ResourcePage>
    );
}
