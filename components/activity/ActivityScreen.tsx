'use client';

import { useEffect, useState } from 'react';
import {
    Banknote, Clock, CreditCard, History, KeyRound, Landmark, Loader2, MapPin, Pencil, Plus, RefreshCw,
    Search, ShieldAlert, Trash2, TrendingDown, TrendingUp, type LucideIcon,
} from 'lucide-react';
import { apiGet, redirectIfUnauthorized } from '@/lib/api-client';
import { describeActivity, pageLinks, type ActivityIcon } from '@/lib/activity';
import { filterYears, MONTH_NAMES } from '@/lib/dates';
import { formatRupees } from '@/lib/format';

const PAGE_SIZE = 10;

const ICONS: Record<ActivityIcon, LucideIcon> = {
    banknote: Banknote, landmark: Landmark, 'credit-card': CreditCard, 'trending-up': TrendingUp,
    'trending-down': TrendingDown, plus: Plus, pencil: Pencil, 'trash-2': Trash2, 'refresh-cw': RefreshCw,
    'shield-alert': ShieldAlert, 'key-round': KeyRound,
};

interface Activity {
    id: number;
    activity_type: string;
    action_type: string;
    description?: string;
    amount?: string | number | null;
    account_info?: string | null;
    activity_date: string;
}

interface ActivityPage {
    activities: Activity[];
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

interface Filters { month: string; year: string }

type Shown = { kind: 'page'; data: ActivityPage } | { kind: 'error'; text: string };

function ActivityItem({ activity }: { activity: Activity }) {
    const label = describeActivity(activity.action_type, activity.activity_type);
    const Icon = ICONS[label.icon];
    const date = new Date(activity.activity_date);
    const day = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return (
        <div className={`activity-item ${label.className}`}>
            <div className="activity-icon"><Icon /></div>
            <div className="activity-content">
                <div className="activity-header-row">
                    <span className="activity-action">{label.text}</span>
                    <span className="activity-amount">{activity.amount ? formatRupees(activity.amount) : '—'}</span>
                </div>
                <div className="activity-description">{activity.description || 'System operation'}</div>
                <div className="activity-meta">
                    <span className="activity-account"><MapPin /> {activity.account_info || 'System'}</span>
                    <span className="activity-timestamp"><Clock /> {day} at {time}</span>
                </div>
            </div>
        </div>
    );
}

export function ActivityScreen() {
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [shown, setShown] = useState<Shown | null>(null);
    const [busy, setBusy] = useState<'load' | 'clear' | null>(null);
    // The filters behind the page on screen; page links keep using them
    const [applied, setApplied] = useState<Filters>({ month: '', year: '' });

    async function load(filters: Filters, page: number) {
        const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        // The API filters by month only together with a year
        if (filters.year) {
            query.set('year', filters.year);
            if (filters.month) query.set('month', filters.month);
        }
        const result = await apiGet<ActivityPage>(`/api/activity?${query}`);
        if (redirectIfUnauthorized(result)) return;
        setApplied(filters);
        setShown(result.ok && Array.isArray(result.data.activities)
            ? { kind: 'page', data: result.data }
            : { kind: 'error', text: 'Failed to load activity data. Please try again.' });
    }

    async function run(kind: 'load' | 'clear', filters: Filters) {
        setBusy(kind);
        try {
            await load(filters, 1);
        } finally {
            setBusy(null);
        }
    }

    useEffect(() => {
        load({ month: '', year: '' }, 1);
        // Runs once on page load; later loads come from the buttons and page links
    }, []);

    if (shown === null) {
        // Rendered only after the first load, so the controls are live when they appear
        return null;
    }

    function clearFilters() {
        setMonth('');
        setYear('');
        run('clear', { month: '', year: '' });
    }

    let feed;
    if (shown.kind === 'error') {
        feed = <p className="error-message">{shown.text}</p>;
    } else if (shown.data.activities.length === 0) {
        feed = <div className="no-activities">No activities found</div>;
    } else {
        const { activities, currentPage, totalPages, totalItems } = shown.data;
        const goTo = (page: number) => { if (page !== currentPage) load(applied, page); };
        feed = (
            <div className="activity-feed">
                <div className="activity-header">
                    <h3><History /> Activity Feed</h3>
                    <div className="activity-stats">
                        <span className="stat-item">{totalItems} Actions</span>
                    </div>
                </div>
                <div className="activity-items">
                    {activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
                </div>
                {totalPages > 1 ? (
                    <div className="pagination">
                        {currentPage > 1 ? <button type="button" className="pagination-btn" data-page={currentPage - 1} onClick={() => goTo(currentPage - 1)}>« Previous</button> : null}
                        {pageLinks(currentPage, totalPages).map((link, index) => (link === 'dots'
                            ? <span key={`dots-${index}`} className="pagination-dots">...</span>
                            : (
                                <button key={link} type="button" className={`pagination-btn${link === currentPage ? ' active' : ''}`} data-page={link}
                                    onClick={() => goTo(link)}>
                                    {link}
                                </button>
                            )))}
                        {currentPage < totalPages ? <button type="button" className="pagination-btn" data-page={currentPage + 1} onClick={() => goTo(currentPage + 1)}>Next »</button> : null}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div id="activity-section">
            <h2>Activity Log</h2>
            <div className="activity-filters">
                <div className="form-group">
                    <label htmlFor="activity-month">Month</label>
                    <select id="activity-month" value={year ? month : ''} disabled={!year} title={year ? undefined : 'Choose a year to filter by month'}
                        onChange={event => setMonth(event.target.value)}>
                        <option value="">All Months</option>
                        {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="activity-year">Year</label>
                    <select id="activity-year" value={year} onChange={event => setYear(event.target.value)}>
                        <option value="">All Years</option>
                        {filterYears().map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div className="form-group activity-button-group">
                    <button type="button" data-action="filterActivity" className={`activity-filter-btn activity-load-btn${busy === 'load' ? ' loading' : ''}`}
                        onClick={() => run('load', { month: year ? month : '', year })}>
                        <span className="btn-icon">{busy === 'load' ? <Loader2 className="spin" /> : <Search />}</span>
                        <span className="btn-text">Load</span>
                    </button>
                    <button type="button" data-action="clearActivityFilters" className={`activity-filter-btn activity-clear-btn${busy === 'clear' ? ' loading' : ''}`}
                        onClick={clearFilters}>
                        <span className="btn-icon">{busy === 'clear' ? <Loader2 className="spin" /> : <Trash2 />}</span>
                        <span className="btn-text">Clear</span>
                    </button>
                </div>
            </div>
            <div id="activity-feed">
                <div id="activity-list">{feed}</div>
            </div>
        </div>
    );
}
