import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { ResourcePage } from '@/components/ResourcePage';

export const metadata: Metadata = { title: 'About BalanceTrack' };

export default function AboutPage() {
    return (
        <ResourcePage icon={Info} title="About BalanceTrack" subtitle="Mission-driven financial transparency">
            <h2>Our Vision</h2>
            <p>
                BalanceTrack was built with a simple goal: to empower individuals with clear, actionable insights into their
                financial health. We believe that professional-grade financial tracking should be accessible, intuitive, and secure.
            </p>
            <h2>Powered by OneMark</h2>
            <p>
                As a product of Team OneMark, BalanceTrack inherits a legacy of precision engineering and user-centric design. Our
                team is dedicated to building tools that help you make better financial decisions every day.
            </p>
            <h2>Commitment to Excellence</h2>
            <p>
                We continuously iterate on our platform based on user feedback and industry standards. From real-time activity
                logging to detailed monthly summaries, every feature is crafted to provide you with the best experience possible.
            </p>
        </ResourcePage>
    );
}
