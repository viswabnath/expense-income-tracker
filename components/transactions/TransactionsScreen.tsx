'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useFormMessage } from '@/components/useFormMessage';
import { apiDelete, apiGet, apiPost, apiPut, httpError, redirectIfUnauthorized } from '@/lib/api-client';
import { filterYears, MONTH_NAMES, toDateInputValue, todayUtcIso } from '@/lib/dates';
import { formatRupees } from '@/lib/format';

interface Account { id: number; name: string }
interface Income {
    id: number; source: string; amount: string; date: string;
    credited_to_type: 'bank' | 'cash'; credited_to_id: number | null; credited_to_name?: string;
}
interface Expense {
    id: number; title: string; amount: string; date: string;
    payment_method: 'cash' | 'bank' | 'credit_card'; payment_source_id: number | null; payment_source_name?: string;
}
interface IncomeDraft { id: number; source: string; amount: string; creditedTo: string; date: string }
interface ExpenseDraft { id: number; title: string; amount: string; paymentMethod: string; date: string }
interface PendingDelete { type: 'income' | 'expense'; id: number; label: string; name: string; amount: string }

/** Dropdown values are "cash" or "<type>-<id>" (bank-3, credit_card-7), as in the legacy forms */
function splitAccount(value: string): [string, string | null] {
    if (value === 'cash') return ['cash', null];
    const dash = value.indexOf('-');
    return [value.slice(0, dash), value.slice(dash + 1)];
}

function accountValue(type: string, id: number | null): string {
    return type === 'cash' ? 'cash' : `${type}-${id}`;
}

/** Legacy toast when an edited entry's new date falls outside the month on screen */
function movedMessage(date: string, month: number, year: number): string | null {
    const edited = new Date(date);
    if (edited.getMonth() + 1 === month && edited.getFullYear() === year) return null;
    return `Transaction moved to ${edited.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Change filter to view it.`;
}

function AccountOptions({ banks, cards }: { banks: Account[]; cards?: Account[] }) {
    return (
        <>
            <option value="cash">Cash</option>
            {banks.map(bank => <option key={`bank-${bank.id}`} value={`bank-${bank.id}`}>{bank.name}</option>)}
            {cards?.map(card => <option key={`credit_card-${card.id}`} value={`credit_card-${card.id}`}>{card.name}</option>)}
        </>
    );
}

function EmptyRow({ text }: { text: string }) {
    return (
        <tr className="empty-row">
            <td colSpan={5}>{text}</td>
        </tr>
    );
}

/** An entry's date as "3 Oct 2026" */
const shortDate = (date: string) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const sum = (rows: { amount: string }[]) => rows.reduce((total, row) => total + (parseFloat(row.amount) || 0), 0);

export function TransactionsScreen() {
    const toast = useToast();
    const now = new Date();
    const [loaded, setLoaded] = useState(false);
    const [trackingOption, setTrackingOption] = useState('both');
    const [banks, setBanks] = useState<Account[]>([]);
    const [cards, setCards] = useState<Account[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // The month on screen, and the filter controls (applied with "Filter Transactions")
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const [filterMonth, setFilterMonth] = useState(period.month);
    const [filterYear, setFilterYear] = useState(period.year);

    const [incomeForm, setIncomeForm] = useState({ source: '', amount: '', creditedTo: 'cash', date: todayUtcIso() });
    const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', paymentMethod: 'cash', date: todayUtcIso() });
    const formMessage = useFormMessage(5000);

    const [editIncome, setEditIncome] = useState<IncomeDraft | null>(null);
    const [editExpense, setEditExpense] = useState<ExpenseDraft | null>(null);
    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

    const loadTransactions = useCallback(async (month: number, year: number) => {
        const query = new URLSearchParams({ month: String(month), year: String(year) });
        const [income, expense] = await Promise.all([
            apiGet<Income[]>(`/api/income?${query}`),
            apiGet<Expense[]>(`/api/expenses?${query}`),
        ]);
        if (redirectIfUnauthorized(income) || redirectIfUnauthorized(expense)) return;
        if (!income.ok || !expense.ok) {
            toast('error', 'Failed to load transactions. Please try again.');
            return;
        }
        setIncomes(income.data);
        setExpenses(expense.data);
    }, [toast]);

    useEffect(() => {
        (async () => {
            const user = await apiGet<{ tracking_option?: string }>('/api/user');
            if (redirectIfUnauthorized(user)) return;
            setTrackingOption(user.data.tracking_option || 'both');
            const [bankResult, cardResult] = await Promise.all([
                apiGet<Account[]>('/api/banks'),
                apiGet<Account[]>('/api/credit-cards'),
                loadTransactions(period.month, period.year),
            ]);
            if (redirectIfUnauthorized(bankResult) || redirectIfUnauthorized(cardResult)) return;
            if (bankResult.ok) setBanks(bankResult.data);
            if (cardResult.ok) setCards(cardResult.data);
            setLoaded(true);
        })();
        // Runs once on page load; later reloads go through loadTransactions directly
    }, []);

    async function filterTransactions() {
        setPeriod({ month: filterMonth, year: filterYear });
        toast('info', `Loading transactions for ${MONTH_NAMES[filterMonth - 1]} ${filterYear}...`);
        await loadTransactions(filterMonth, filterYear);
    }

    async function addIncome() {
        const { source, amount, creditedTo, date } = incomeForm;
        if (!source || !amount || !date) return formMessage.show('error', 'Please fill all fields');
        const [creditedToType, creditedToId] = splitAccount(creditedTo);
        const result = await apiPost('/api/income', { source, amount: parseFloat(amount), creditedToType, creditedToId, date });
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return formMessage.show('error', httpError(result));
        setIncomeForm(form => ({ ...form, source: '', amount: '' }));
        formMessage.show('success', 'Income added successfully!');
        await loadTransactions(period.month, period.year);
    }

    async function addExpense() {
        const { title, amount, paymentMethod, date } = expenseForm;
        if (!title || !amount || !date) return formMessage.show('error', 'Please fill all fields');
        const [method, paymentSourceId] = splitAccount(paymentMethod);
        const result = await apiPost('/api/expenses', { title, amount: parseFloat(amount), paymentMethod: method, paymentSourceId, date });
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return formMessage.show('error', httpError(result));
        setExpenseForm(form => ({ ...form, title: '', amount: '' }));
        formMessage.show('success', 'Expense added successfully!');
        await loadTransactions(period.month, period.year);
    }

    // Edit and delete fetch the entry first, like the legacy screen, so the dialog shows saved values
    async function startEditIncome(id: number) {
        const result = await apiGet<Income>(`/api/income/${id}`);
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', 'Failed to load income details for editing');
        const income = result.data;
        setEditIncome({
            id, source: income.source, amount: String(income.amount),
            creditedTo: accountValue(income.credited_to_type, income.credited_to_id), date: toDateInputValue(income.date),
        });
    }

    async function startEditExpense(id: number) {
        const result = await apiGet<Expense>(`/api/expenses/${id}`);
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', 'Failed to load expense details for editing');
        const expense = result.data;
        setEditExpense({
            id, title: expense.title, amount: String(expense.amount),
            paymentMethod: accountValue(expense.payment_method, expense.payment_source_id), date: toDateInputValue(expense.date),
        });
    }

    async function saveIncome() {
        if (!editIncome) return;
        const { id, source, amount, creditedTo, date } = editIncome;
        if (!source || !amount || !date) return toast('error', 'Please fill all fields');
        const [creditedToType, creditedToId] = splitAccount(creditedTo);
        const result = await apiPut(`/api/income/${id}`, { source, amount: parseFloat(amount), creditedToType, creditedToId, date });
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', 'Failed to update income transaction');
        setEditIncome(null);
        toast('success', 'Income transaction updated successfully!');
        const moved = movedMessage(date, period.month, period.year);
        if (moved) toast('info', moved);
        await loadTransactions(period.month, period.year);
    }

    async function saveExpense() {
        if (!editExpense) return;
        const { id, title, amount, paymentMethod, date } = editExpense;
        if (!title || !amount || !date) return toast('error', 'Please fill all fields');
        const [method, paymentSourceId] = splitAccount(paymentMethod);
        const result = await apiPut(`/api/expenses/${id}`, { title, amount: parseFloat(amount), paymentMethod: method, paymentSourceId, date });
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', 'Failed to update expense transaction');
        setEditExpense(null);
        toast('success', 'Expense transaction updated successfully!');
        const moved = movedMessage(date, period.month, period.year);
        if (moved) toast('info', moved);
        await loadTransactions(period.month, period.year);
    }

    async function startDelete(type: 'income' | 'expense', id: number) {
        const result = await apiGet<Income & Expense>(`/api/${type === 'income' ? 'income' : 'expenses'}/${id}`);
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', type === 'income' ? 'Failed to load income details' : 'Failed to load expense details');
        setPendingDelete(type === 'income'
            ? { type, id, label: 'Source', name: result.data.source, amount: result.data.amount }
            : { type, id, label: 'Title', name: result.data.title, amount: result.data.amount });
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        const { type, id } = pendingDelete;
        const result = await apiDelete(`/api/${type === 'income' ? 'income' : 'expenses'}/${id}`);
        if (redirectIfUnauthorized(result)) return;
        if (!result.ok) return toast('error', 'Failed to delete transaction');
        toast('success', type === 'income' ? 'Income transaction deleted successfully!' : 'Expense transaction deleted successfully!');
        setPendingDelete(null);
        await loadTransactions(period.month, period.year);
    }

    if (!loaded) {
        // Rendered only after the data loads, so nothing can be typed or picked before the form is live
        return null;
    }

    const showIncome = trackingOption !== 'expenses';
    const showExpenses = trackingOption !== 'income';
    const incomeTotal = sum(incomes);
    const expenseTotal = sum(expenses);
    const periodName = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    const modalButtons = (saveAction: string, closeAction: string, onSave: () => void, onClose: () => void) => (
        <>
            <button type="button" data-action={closeAction} className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" data-action={saveAction} className="btn btn-primary" onClick={onSave}>Save changes</button>
        </>
    );
    const rowActions = (type: 'income' | 'expense', id: number) => (
        <span className="row-actions">
            <button type="button" className="icon-btn" data-action={`edit-${type}`} data-id={id}
                onClick={() => (type === 'income' ? startEditIncome(id) : startEditExpense(id))}>
                <Pencil aria-hidden="true" /> Edit
            </button>
            <button type="button" className="icon-btn danger" data-action={`delete-${type}`} data-id={id}
                onClick={() => startDelete(type, id)}>
                <Trash2 aria-hidden="true" /> Delete
            </button>
        </span>
    );

    return (
        <div id="transactions-section">
            <div className="page-header">
                <div>
                    <h2>Transactions</h2>
                    <p>Add what comes in and goes out. Showing {periodName}.</p>
                </div>
                <div className="period-picker transaction-filters">
                    <div className="field">
                        <label htmlFor="transaction-month">Month</label>
                        <select id="transaction-month" value={filterMonth} onChange={event => setFilterMonth(Number(event.target.value))}>
                            {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label htmlFor="transaction-year">Year</label>
                        <select id="transaction-year" value={filterYear} onChange={event => setFilterYear(Number(event.target.value))}>
                            {filterYears().map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                    <button type="button" id="filter-transactions" className="btn btn-secondary" data-action="filterTransactions" onClick={filterTransactions}>
                        <Search aria-hidden="true" /> Show
                    </button>
                </div>
            </div>

            <div className={`stats ${showIncome && showExpenses ? 'three' : 'two'}`}>
                {showIncome ? (
                    <div className="stat">
                        <span className="stat-top"><span className="icon-tile t-income" aria-hidden="true"><TrendingUp /></span> Money in</span>
                        <span className="stat-value">{formatRupees(incomeTotal)}</span>
                        <span className="stat-note">{incomes.length} {incomes.length === 1 ? 'entry' : 'entries'} in {periodName}</span>
                    </div>
                ) : null}
                {showExpenses ? (
                    <div className="stat">
                        <span className="stat-top"><span className="icon-tile t-expense" aria-hidden="true"><TrendingDown /></span> Money out</span>
                        <span className="stat-value">{formatRupees(expenseTotal)}</span>
                        <span className="stat-note">{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'} in {periodName}</span>
                    </div>
                ) : null}
                {showIncome && showExpenses ? (
                    <div className="stat hero">
                        <span className="stat-top"><ArrowLeftRight size={18} aria-hidden="true" /> Difference</span>
                        <span className="stat-value">{formatRupees(incomeTotal - expenseTotal)}</span>
                        <span className="stat-note">{incomeTotal >= expenseTotal ? 'More came in than went out' : 'More went out than came in'}</span>
                    </div>
                ) : null}
            </div>

            <div id="forms-wrapper" className={`entry-forms${showIncome && showExpenses ? '' : ' one'}`}>
                <form id="income-form" className={`card entry-form${showIncome ? '' : ' hidden'}`} onSubmit={event => { event.preventDefault(); addIncome(); }}>
                    <h3><span className="icon-tile t-income" aria-hidden="true"><TrendingUp /></span>Add income</h3>
                    <div className="form-grid two">
                        <div className="field">
                            <label htmlFor="income-source">Source</label>
                            <input type="text" id="income-source" placeholder="Salary, freelance..." value={incomeForm.source}
                                onChange={event => setIncomeForm(form => ({ ...form, source: event.target.value }))} />
                        </div>
                        <div className="field">
                            <label htmlFor="income-amount">Amount (₹)</label>
                            <input type="number" id="income-amount" inputMode="decimal" placeholder="0.00" step="0.01" value={incomeForm.amount}
                                onChange={event => setIncomeForm(form => ({ ...form, amount: event.target.value }))} />
                        </div>
                        <div className="field">
                            <label htmlFor="income-credited-to">Received in</label>
                            <select id="income-credited-to" value={incomeForm.creditedTo}
                                onChange={event => setIncomeForm(form => ({ ...form, creditedTo: event.target.value }))}>
                                <AccountOptions banks={banks} />
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="income-date">Date</label>
                            <input type="date" id="income-date" value={incomeForm.date}
                                onChange={event => setIncomeForm(form => ({ ...form, date: event.target.value }))} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" data-action="addIncome"><Plus aria-hidden="true" /> Add income</button>
                </form>
                <form id="expense-form" className={`card entry-form expense${showExpenses ? '' : ' hidden'}`} onSubmit={event => { event.preventDefault(); addExpense(); }}>
                    <h3><span className="icon-tile t-expense" aria-hidden="true"><TrendingDown /></span>Add expense</h3>
                    <div className="form-grid two">
                        <div className="field">
                            <label htmlFor="expense-title">What for</label>
                            <input type="text" id="expense-title" placeholder="Groceries, rent..." value={expenseForm.title}
                                onChange={event => setExpenseForm(form => ({ ...form, title: event.target.value }))} />
                        </div>
                        <div className="field">
                            <label htmlFor="expense-amount">Amount (₹)</label>
                            <input type="number" id="expense-amount" inputMode="decimal" placeholder="0.00" step="0.01" value={expenseForm.amount}
                                onChange={event => setExpenseForm(form => ({ ...form, amount: event.target.value }))} />
                        </div>
                        <div className="field">
                            <label htmlFor="expense-payment-method">Paid from</label>
                            <select id="expense-payment-method" value={expenseForm.paymentMethod}
                                onChange={event => setExpenseForm(form => ({ ...form, paymentMethod: event.target.value }))}>
                                <AccountOptions banks={banks} cards={cards} />
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="expense-date">Date</label>
                            <input type="date" id="expense-date" value={expenseForm.date}
                                onChange={event => setExpenseForm(form => ({ ...form, date: event.target.value }))} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" data-action="addExpense"><Plus aria-hidden="true" /> Add expense</button>
                </form>
            </div>
            <div id="transactions-message" className={formMessage.message?.kind ?? 'error'} role="status">{formMessage.message?.text ?? ''}</div>

            <div id="transactions-history" className="histories">
                <section id="income-history" className="card" style={{ display: showIncome ? undefined : 'none' }} aria-labelledby="income-history-title">
                    <div className="card-head">
                        <h3 id="income-history-title">Income</h3>
                        <span className="meta">{periodName}</span>
                    </div>
                    <div className="table-wrap scrollable-table">
                        <table className="data-table stackable">
                            <thead>
                                <tr><th scope="col">Date</th><th scope="col">Source</th><th scope="col" className="amount">Amount</th><th scope="col">Received in</th><th scope="col" className="actions"><span className="sr-only">Actions</span></th></tr>
                            </thead>
                            <tbody id="income-table-body">
                                {incomes.length === 0 ? <EmptyRow text="No income transactions found for this period" /> : incomes.map(income => (
                                    <tr key={income.id}>
                                        <td className="sub" data-label="Date">{shortDate(income.date)}</td>
                                        <td className="name">{income.source}</td>
                                        <td className="amount in" data-label="Amount">{formatRupees(income.amount)}</td>
                                        <td className="sub" data-label="Received in">{income.credited_to_name || 'Unknown'}</td>
                                        <td className="actions">{rowActions('income', income.id)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                <section id="expense-history" className="card" style={{ display: showExpenses ? undefined : 'none' }} aria-labelledby="expense-history-title">
                    <div className="card-head">
                        <h3 id="expense-history-title">Expenses</h3>
                        <span className="meta">{periodName}</span>
                    </div>
                    <div className="table-wrap scrollable-table">
                        <table className="data-table stackable">
                            <thead>
                                <tr><th scope="col">Date</th><th scope="col">What for</th><th scope="col" className="amount">Amount</th><th scope="col">Paid from</th><th scope="col" className="actions"><span className="sr-only">Actions</span></th></tr>
                            </thead>
                            <tbody id="expense-table-body">
                                {expenses.length === 0 ? <EmptyRow text="No expense transactions found for this period" /> : expenses.map(expense => (
                                    <tr key={expense.id}>
                                        <td className="sub" data-label="Date">{shortDate(expense.date)}</td>
                                        <td className="name">{expense.title}</td>
                                        <td className="amount out" data-label="Amount">{formatRupees(expense.amount)}</td>
                                        <td className="sub" data-label="Paid from">{expense.payment_source_name || 'Unknown'}</td>
                                        <td className="actions">{rowActions('expense', expense.id)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <Modal id="edit-income-modal" title="Edit income" open={editIncome !== null} closeAction="close-edit-income"
                onClose={() => setEditIncome(null)}
                footer={modalButtons('save-income-edit', 'close-edit-income', saveIncome, () => setEditIncome(null))}>
                <div className="form-grid">
                    <div className="field">
                        <label htmlFor="edit-income-source">Source</label>
                        <input type="text" id="edit-income-source" required value={editIncome?.source ?? ''}
                            onChange={event => setEditIncome(draft => draft && { ...draft, source: event.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="edit-income-amount">Amount (₹)</label>
                        <input type="number" id="edit-income-amount" inputMode="decimal" step="0.01" min="0" required value={editIncome?.amount ?? ''}
                            onChange={event => setEditIncome(draft => draft && { ...draft, amount: event.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="edit-income-credited-to">Received in</label>
                        <select id="edit-income-credited-to" required value={editIncome?.creditedTo ?? 'cash'}
                            onChange={event => setEditIncome(draft => draft && { ...draft, creditedTo: event.target.value })}>
                            <AccountOptions banks={banks} />
                        </select>
                    </div>
                    <div className="field">
                        <label htmlFor="edit-income-date">Date</label>
                        <input type="date" id="edit-income-date" required value={editIncome?.date ?? ''}
                            onChange={event => setEditIncome(draft => draft && { ...draft, date: event.target.value })} />
                    </div>
                </div>
            </Modal>

            <Modal id="edit-expense-modal" title="Edit expense" open={editExpense !== null} closeAction="close-edit-expense"
                onClose={() => setEditExpense(null)}
                footer={modalButtons('save-expense-edit', 'close-edit-expense', saveExpense, () => setEditExpense(null))}>
                <div className="form-grid">
                    <div className="field">
                        <label htmlFor="edit-expense-title">What for</label>
                        <input type="text" id="edit-expense-title" required value={editExpense?.title ?? ''}
                            onChange={event => setEditExpense(draft => draft && { ...draft, title: event.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="edit-expense-amount">Amount (₹)</label>
                        <input type="number" id="edit-expense-amount" inputMode="decimal" step="0.01" min="0" required value={editExpense?.amount ?? ''}
                            onChange={event => setEditExpense(draft => draft && { ...draft, amount: event.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="edit-expense-payment-method">Paid from</label>
                        <select id="edit-expense-payment-method" required value={editExpense?.paymentMethod ?? 'cash'}
                            onChange={event => setEditExpense(draft => draft && { ...draft, paymentMethod: event.target.value })}>
                            <AccountOptions banks={banks} cards={cards} />
                        </select>
                    </div>
                    <div className="field">
                        <label htmlFor="edit-expense-date">Date</label>
                        <input type="date" id="edit-expense-date" required value={editExpense?.date ?? ''}
                            onChange={event => setEditExpense(draft => draft && { ...draft, date: event.target.value })} />
                    </div>
                </div>
            </Modal>

            <Modal id="delete-confirmation-modal" title="Delete this entry?" small open={pendingDelete !== null} closeAction="close-delete"
                onClose={() => setPendingDelete(null)}
                footer={(
                    <>
                        <button type="button" data-action="close-delete" className="btn btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
                        <button type="button" data-action="confirm-delete" className="btn btn-danger" onClick={confirmDelete}>
                            <Trash2 aria-hidden="true" /> Delete
                        </button>
                    </>
                )}>
                <p id="delete-confirmation-message" className="lead">
                    {pendingDelete ? (
                        <>
                            Are you sure you want to delete this {pendingDelete.type} transaction?<br />
                            <span className="sub">{pendingDelete.label}: {pendingDelete.name}<br />Amount: {formatRupees(pendingDelete.amount)}</span>
                        </>
                    ) : 'Are you sure you want to delete this transaction?'}
                </p>
                <p>This cannot be undone. The account balance is adjusted back.</p>
            </Modal>
        </div>
    );
}
