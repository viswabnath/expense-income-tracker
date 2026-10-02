'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, BarChart3, CreditCard, Gem, Landmark, List, PlusCircle, Settings, TrendingDown, TrendingUp } from 'lucide-react';
import { apiGet, httpError, redirectIfUnauthorized } from '@/lib/api-client';
import { filterYears, MONTH_NAMES } from '@/lib/dates';
import { formatRupees } from '@/lib/format';

type Amount = string | number | null | undefined;

interface Summary {
    message?: string;
    isCurrentMonth?: boolean;
    isMonthCompleted?: boolean;
    trackingOption?: string;
    monthlyIncome?: Amount;
    totalExpenses?: Amount;
    totalCurrentWealth?: Amount;
    netSavings?: Amount;
    totalInitialBalance?: Amount;
    cash?: { balance?: Amount } | null;
    banks?: { id?: number; name?: string; current_balance?: Amount }[];
    creditCards?: { id?: number; name?: string; credit_limit?: Amount; current_balance?: Amount }[];
}

type Shown =
    | { kind: 'summary'; data: Summary; month: number; year: number }
    | { kind: 'error'; text: string };

const present = (value: Amount): value is string | number => value !== undefined && value !== null;

/** The legacy explanation under a "no data" message */
function messageDetail(message: string): string {
    if (message.includes('Future')) return 'Cannot show data for future dates.';
    if (message.includes('before registration')) return 'You were not registered during this period.';
    if (message.includes('No transactions found')) return 'You were registered but haven\'t added any transactions or setup accounts for this month.';
    return 'No data available for the selected period.';
}

function SummaryCard({ kind, icon: Icon, title, amount, subtitle, missingSubtitle }: {
    kind: string; icon: typeof TrendingUp; title: string; amount: Amount; subtitle: string; missingSubtitle: string;
}) {
    const has = present(amount);
    return (
        <div className={`summary-card ${kind}`} style={has ? undefined : { opacity: 0.6 }}>
            <h3><Icon /> {title}</h3>
            <div className="summary-amount">{formatRupees(has ? amount : 0)}</div>
            <div className="summary-subtitle">{has ? subtitle : missingSubtitle}</div>
        </div>
    );
}

function SummaryView({ data, month, year }: { data: Summary; month: number; year: number }) {
    const router = useRouter();
    const monthName = MONTH_NAMES[month - 1];
    // Legacy wording: "as of now" for the current month, otherwise the month's end
    const timeReference = data.isCurrentMonth ? 'as of now' : `at End of ${monthName}`;
    const heading = (
        <h2 style={{ textAlign: 'center', color: '#495057', marginBottom: 30 }}>
            <BarChart3 style={{ verticalAlign: 'middle', marginRight: 8 }} /> {monthName} {year} Financial Summary
        </h2>
    );

    if (data.message) {
        const noTransactions = data.message.includes('No transactions found');
        return (
            <>
                {heading}
                <div className="summary">
                    <h3 style={{ color: '#666', textAlign: 'center' }}>{data.message}</h3>
                    <p style={{ textAlign: 'center', color: '#999', marginBottom: 20 }}>{messageDetail(data.message)}</p>
                    {noTransactions ? (
                        <div style={{ textAlign: 'center' }}>
                            <button type="button" className="primary-button setup-accounts-btn" style={{ marginRight: 10 }} onClick={() => router.push('/setup')}>
                                <Settings /> Setup Accounts
                            </button>
                            <button type="button" className="primary-button add-transactions-btn" onClick={() => router.push('/transactions')}>
                                <PlusCircle /> Add Transactions
                            </button>
                        </div>
                    ) : null}
                </div>
            </>
        );
    }

    const showCards = data.trackingOption === 'expenses' || data.trackingOption === 'both';
    const netSavingsNegative = present(data.netSavings) && parseFloat(String(data.netSavings)) < 0;
    const cashBalance = data.cash ? data.cash.balance : undefined;
    const cashAvailable = present(cashBalance) && !Number.isNaN(Number(cashBalance));
    const showBreakdown = present(data.netSavings) && data.totalInitialBalance !== undefined
        && data.monthlyIncome !== undefined && data.totalExpenses !== undefined;

    return (
        <>
            {heading}
            <div className="summary-dashboard">
                <SummaryCard kind="income" icon={TrendingUp} title="Monthly Income" amount={data.monthlyIncome}
                    subtitle="Money earned this month" missingSubtitle="No income data available" />
                <SummaryCard kind="expense" icon={TrendingDown} title="Monthly Expenses" amount={data.totalExpenses}
                    subtitle="Money spent this month" missingSubtitle="No expense data available" />
                <SummaryCard kind="wealth" icon={Gem} title="Total Wealth" amount={data.totalCurrentWealth}
                    subtitle={`Banks + Cash ${timeReference}`} missingSubtitle="Unable to calculate wealth" />
                <SummaryCard kind="savings" icon={present(data.netSavings) ? (netSavingsNegative ? TrendingDown : TrendingUp) : BarChart3}
                    title="Net Savings" amount={data.netSavings}
                    subtitle="Income - Expenses + Initial" missingSubtitle="Unable to calculate savings" />
            </div>

            <div className="accounts-section">
                <h3 style={{ color: '#495057', marginBottom: 20 }}>
                    <CreditCard style={{ verticalAlign: 'middle', marginRight: 8 }} /> Account Balances {timeReference}
                </h3>
                <div className="accounts-grid">
                    {data.cash ? (
                        <div className="account-card cash" style={cashAvailable ? undefined : { opacity: 0.6 }}>
                            <h4><Banknote /> Cash Balance</h4>
                            {cashAvailable
                                ? <div className="account-balance">{formatRupees(cashBalance)}</div>
                                : <div className="account-balance" style={{ color: '#6c757d' }}>Unavailable</div>}
                        </div>
                    ) : null}
                    {(data.banks ?? []).map((bank, index) => (
                        <div key={bank.id ?? `bank-${index}`} className="account-card bank" style={present(bank.current_balance) ? undefined : { opacity: 0.6 }}>
                            <h4><Landmark /> {bank.name || 'Unknown Bank'}</h4>
                            {present(bank.current_balance)
                                ? <div className="account-balance">{formatRupees(bank.current_balance)}</div>
                                : <div className="account-balance" style={{ color: '#6c757d' }}>Unavailable</div>}
                        </div>
                    ))}
                    {showCards ? (data.creditCards ?? []).map((card, index) => {
                        const limit = parseFloat(String(card.credit_limit || 0));
                        const used = parseFloat(String(card.current_balance || 0));
                        return (
                            <div key={card.id ?? `card-${index}`} className="account-card credit">
                                <h4><CreditCard /> {card.name || 'Unknown Card'}</h4>
                                <div className="account-balance" style={{ color: '#dc3545' }}>{formatRupees(used)} used</div>
                                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 5 }}>
                                    {formatRupees(limit - used)} available of {formatRupees(limit)}
                                </div>
                            </div>
                        );
                    }) : null}
                </div>
            </div>

            {showBreakdown ? (
                <div style={{ marginTop: 30, padding: 15, background: '#f8f9fa', borderRadius: 8, borderLeft: '4px solid #007bff' }}>
                    <h4 style={{ color: '#495057', marginBottom: 10 }}>
                        <List style={{ verticalAlign: 'middle', marginRight: 8 }} /> Calculation Breakdown
                    </h4>
                    <div style={{ fontSize: 14, color: '#6c757d', lineHeight: 1.6 }}>
                        <strong>Net Savings Formula</strong><br />
                        Initial Balance ({formatRupees(data.totalInitialBalance || 0)}) +{' '}
                        Income ({formatRupees(data.monthlyIncome || 0)}) -{' '}
                        Expenses ({formatRupees(data.totalExpenses || 0)}) ={' '}
                        <strong>{formatRupees(data.netSavings)}</strong>
                    </div>
                </div>
            ) : null}
        </>
    );
}

export function SummaryScreen() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [shown, setShown] = useState<Shown | null>(null);

    async function loadSummary(forMonth: number, forYear: number) {
        const result = await apiGet<Summary>(`/api/monthly-summary?month=${forMonth}&year=${forYear}`);
        if (redirectIfUnauthorized(result)) return;
        setShown(result.ok
            ? { kind: 'summary', data: result.data, month: forMonth, year: forYear }
            : { kind: 'error', text: `Error loading summary: ${httpError(result)}` });
    }

    useEffect(() => {
        // Like the legacy screen, opening it loads the current month
        loadSummary(month, year);
        // Runs once on page load; later loads come from the Load Summary button
    }, []);

    if (shown === null) {
        // Rendered only after the first load, so the controls are live when they appear
        return null;
    }

    return (
        <div id="summary-section">
            <h2>Monthly Summary</h2>
            <div className="summary-controls">
                <div className="form-group">
                    <label htmlFor="summary-month">Month</label>
                    <select id="summary-month" value={month} onChange={event => setMonth(Number(event.target.value))}>
                        {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="summary-year">Year</label>
                    <select id="summary-year" value={year} onChange={event => setYear(Number(event.target.value))}>
                        {filterYears().map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <button type="button" data-action="loadMonthlySummary" onClick={() => loadSummary(month, year)}>
                        <span className="icon-enhanced"><BarChart3 /></span>Load Summary
                    </button>
                </div>
            </div>
            <div id="summary-display">
                {shown.kind === 'error'
                    ? <p className="error">{shown.text}</p>
                    : <SummaryView data={shown.data} month={shown.month} year={shown.year} />}
            </div>
        </div>
    );
}
