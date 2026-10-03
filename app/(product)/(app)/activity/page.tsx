import type { Metadata } from 'next';
import { ActivityScreen } from '@/components/activity/ActivityScreen';

export const metadata: Metadata = { title: 'Activity Log - FinDB' };

export default function ActivityPage() {
    return <ActivityScreen />;
}
