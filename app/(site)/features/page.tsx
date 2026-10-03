import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FEATURES, type FeatureStatus } from '@/components/site/content';
import { FeatureIcon } from '@/components/site/FeatureIcon';
import { StatusBadge } from '@/components/site/StatusBadge';

export const metadata: Metadata = {
    title: 'Features',
    description: 'Everything FinDB tracks: accounts, spending, statement import, loans, chit funds, credit cards, gold, property, savings, insurance, tax and your net worth.',
};

const GROUPS: { status: FeatureStatus; title: string; text: string }[] = [
    { status: 'available', title: 'In the app today', text: 'Ready to use right now, free.' },
    { status: 'building', title: 'Being built now', text: 'Arriving before and at the public launch.' },
    { status: 'planned', title: 'Coming later', text: 'The rest of your money, from gold to your family\'s estate.' },
];

export default function FeaturesPage() {
    return (
        <>
            <section className="page-head">
                <div className="wrap">
                    <span className="eyebrow rise">Features</span>
                    <h1 className="rise rise-2">Everything your money touches, in one place.</h1>
                    <p className="lede rise rise-3">
                        Fourteen parts, each explained in plain words with a real example. Turn on only the ones you need;
                        the rest stay out of your way.
                    </p>
                </div>
            </section>

            {GROUPS.map(group => {
                const features = FEATURES.filter(feature => feature.status === group.status);
                return (
                    <section key={group.status} className="section-tight" aria-labelledby={`group-${group.status}`}>
                        <div className="wrap">
                            <div className="section-head" style={{ marginBottom: 24 }}>
                                <StatusBadge status={group.status} />
                                <h2 id={`group-${group.status}`} style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>{group.title}</h2>
                                <p className="lede">{group.text}</p>
                            </div>
                            <div className={`feature-grid${features.length % 3 === 0 ? '' : ' two'}`}>
                                {features.map(feature => (
                                    <Link key={feature.slug} href={`/features/${feature.slug}`} className="feature-card reveal">
                                        <FeatureIcon name={feature.icon} />
                                        <h3>{feature.name}</h3>
                                        <p>{feature.short}</p>
                                        <span className="more">Learn more <ArrowRight size={16} /></span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })}
        </>
    );
}
