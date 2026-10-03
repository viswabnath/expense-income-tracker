import { STATUS_LABELS, type FeatureStatus } from './content';

/** Where a feature stands: available now, in development, or planned */
export function StatusBadge({ status }: { status: FeatureStatus }) {
    return <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>;
}
