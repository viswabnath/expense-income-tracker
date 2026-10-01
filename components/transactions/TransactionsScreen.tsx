'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Save, Search, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
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
        <tr>
            <td colSpan={5} style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', padding: 20 }}>{text}</td>
        </tr>
    );
}

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
    const modalButtons = (saveAction: string, closeAction: string, onSave: () => void, onClose: () => void) => (
        <>
            <button type="button" data-action={saveAction} className="primary-button" onClick={onSave}>
                <span className="icon-enhanced"><Save /></span>Save Changes
            </button>
            <button type="button" data-action={closeAction} className="secondary-button" onClick={onClose}>
                <span className="icon-enhanced"><X /></span>Cancel
            </button>
        </>
    );
    const rowActions = (type: 'income' | 'expense', id: number) => (
        <div className="action-buttons">
            <button type="button" className="action-btn edit-btn" data-action={`edit-${type}`} data-id={id}
                onClick={() => (type === 'income' ? startEditIncome(id) : startEditExpense(id))}>
                <Pencil /> Edit
            </button>
            <button type="button" className="action-btn delete-btn" data-action={`delete-${type}`} data-id={id}
                onClick={() => startDelete(type, id)}>
                <Trash2 /> Delete
            </button>
        </div>
    );

    return (
        <div id="transactions-section">
            <h2>Transactions</h2>

            <div className="transaction-filters">
                <div className="form-group">
                    <label htmlFor="transaction-month">Filter by Month</label>
                    <select id="transaction-month" value={filterMonth} onChange={event => setFilterMonth(Number(event.target.value))}>
                        {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="transaction-year">Filter by Year</label>
                    <select id="transaction-year" value={filterYear} onChange={event => setFilterYear(Number(event.target.value))}>
                        {filterYears().map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <button type="button" id="filter-transactions" data-action="filterTransactions" onClick={filterTransactions}>
                        <span className="icon-enhanced"><Search /></span>Filter Transactions
                    </button>
                </div>
            </div>

            <div id="forms-wrapper">
                <div id="income-form" className={showIncome ? undefined : 'hidden'}>
                    <h3>Add Income</h3>
                    <div className="form-group">
                        <label htmlFor="income-source">Source</label>
                        <input type="text" id="income-source" placeholder="Salary, Freelance, etc." value={incomeForm.source}
                            onChange={event => setIncomeForm(form => ({ ...form, source: event.target.value }))} />
                        <label htmlFor="income-amount">Amount</label>
                        <input type="number" id="income-amount" placeholder="0.00" step="0.01" value={incomeForm.amount}
                            onChange={event => setIncomeForm(form => ({ ...form, amount: event.target.value }))} />
                        <label htmlFor="income-credited-to">Credited To</label>
                        <select id="income-credited-to" value={incomeForm.creditedTo}
                            onChange={event => setIncomeForm(form => ({ ...form, creditedTo: event.target.value }))}>
                            <AccountOptions banks={banks} />
                        </select>
                        <label htmlFor="income-date">Date</label>
                        <input type="date" id="income-date" value={incomeForm.date}
                            onChange={event => setIncomeForm(form => ({ ...form, date: event.target.value }))} />
                        <button type="button" data-action="addIncome" onClick={addIncome}>
                            <span className="icon-enhanced"><TrendingUp /></span>Add Income
                        </button>
                    </div>
                </div>
                <div id="expense-form" className={showExpenses ? undefined : 'hidden'}>
                    <h3>Add Expense</h3>
                    <div className="form-group">
                        <label htmlFor="expense-title">Title</label>
                        <input type="text" id="expense-title" placeholder="Groceries, Rent, etc." value={expenseForm.title}
                            onChange={event => setExpenseForm(form => ({ ...form, title: event.target.value }))} />
                        <label htmlFor="expense-amount">Amount</label>
                        <input type="number" id="expense-amount" placeholder="0.00" step="0.01" value={expenseForm.amount}
                            onChange={event => setExpenseForm(form => ({ ...form, amount: event.target.value }))} />
                        <label htmlFor="expense-payment-method">Payment Method</label>
                        <select id="expense-payment-method" value={expenseForm.paymentMethod}
                            onChange={event => setExpenseForm(form => ({ ...form, paymentMethod: event.target.value }))}>
                            <AccountOptions banks={banks} cards={cards} />
                        </select>
                        <label htmlFor="expense-date">Date</label>
                        <input type="date" id="expense-date" value={expenseForm.date}
                            onChange={event => setExpenseForm(form => ({ ...form, date: event.target.value }))} />
                        <button type="button" data-action="addExpense" onClick={addExpense}>
                            <span className="icon-enhanced"><TrendingDown /></span>Add Expense
                        </button>
                    </div>
                </div>
            </div>
            <div id="transactions-message" className={formMessage.message?.kind ?? 'error'}>{formMessage.message?.text ?? ''}</div>

            <div id="transactions-history">
                <div id="income-history" style={{ display: showIncome ? 'block' : 'none' }}>
                    <h3>Income History</h3>
                    <div className="scrollable-table">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Source</th><th>Amount</th><th>Credited To</th><th>Actions</th></tr>
                            </thead>
                            <tbody id="income-table-body">
                                {incomes.length === 0 ? <EmptyRow text="No income transactions found for this period" /> : incomes.map(income => (
                                    <tr key={income.id}>
                                        <td>{new Date(income.date).toLocaleDateString()}</td>
                                        <td>{income.source}</td>
                                        <td>{formatRupees(income.amount)}</td>
                                        <td>{income.credited_to_name || 'Unknown'}</td>
                                        <td>{rowActions('income', income.id)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="expense-history" style={{ display: showExpenses ? 'block' : 'none' }}>
                    <h3>Expense History</h3>
                    <div className="scrollable-table">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Title</th><th>Amount</th><th>Payment Method</th><th>Actions</th></tr>
                            </thead>
                            <tbody id="expense-table-body">
                                {expenses.length === 0 ? <EmptyRow text="No expense transactions found for this period" /> : expenses.map(expense => (
                                    <tr key={expense.id}>
                                        <td>{new Date(expense.date).toLocaleDateString()}</td>
                                        <td>{expense.title}</td>
                                        <td>{formatRupees(expense.amount)}</td>
                                        <td>{expense.payment_source_name || 'Unknown'}</td>
                                        <td>{rowActions('expense', expense.id)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal id="edit-income-modal" title="Edit Income Transaction" open={editIncome !== null} closeAction="close-edit-income"
                onClose={() => setEditIncome(null)}
                footer={modalButtons('save-income-edit', 'close-edit-income', saveIncome, () => setEditIncome(null))}>
                <div className="form-group">
                    <label htmlFor="edit-income-source">Income Source</label>
                    <input type="text" id="edit-income-source" required placeholder="Enter income source" value={editIncome?.source ?? ''}
                        onChange={event => setEditIncome(draft => draft && { ...draft, source: event.target.value })} />
                </div>
                <div className="form-group">
                    <label htmlFor="edit-income-amount">Amount (₹)</label>
                    <input type="number" id="edit-income-amount" step="0.01" min="0" required placeholder="0.00" value={editIncome?.amount ?? ''}
                        onChange={event => setEditIncome(draft => draft && { ...draft, amount: event.target.value })} />
                </div>
                <div className="form-group">
                    <label htmlFor="edit-income-credited-to">Credited To</label>
                    <select id="edit-income-credited-to" required value={editIncome?.creditedTo ?? 'cash'}
                        onChange={event => setEditIncome(draft => draft && { ...draft, creditedTo: event.target.value })}>
                        <AccountOptions banks={banks} />
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="edit-income-date">Date</label>
                    <input type="date" id="edit-income-date" required value={editIncome?.date ?? ''}
                        onChange={event => setEditIncome(draft => draft && { ...draft, date: event.target.value })} />
                </div>
            </Modal>

            <Modal id="edit-expense-modal" title="Edit Expense Transaction" open={editExpense !== null} closeAction="close-edit-expense"
                onClose={() => setEditExpense(null)}
                footer={modalButtons('save-expense-edit', 'close-edit-expense', saveExpense, () => setEditExpense(null))}>
                <div className="form-group">
                    <label htmlFor="edit-expense-title">Expense Title</label>
                    <input type="text" id="edit-expense-title" required placeholder="Enter expense title" value={editExpense?.title ?? ''}
                        onChange={event => setEditExpense(draft => draft && { ...draft, title: event.target.value })} />
                </div>
                <div className="form-group">
                    <label htmlFor="edit-expense-amount">Amount (₹)</label>
                    <input type="number" id="edit-expense-amount" step="0.01" min="0" required placeholder="0.00" value={editExpense?.amount ?? ''}
                        onChange={event => setEditExpense(draft => draft && { ...draft, amount: event.target.value })} />
                </div>
                <div className="form-group">
                    <label htmlFor="edit-expense-payment-method">Payment Method</label>
                    <select id="edit-expense-payment-method" required value={editExpense?.paymentMethod ?? 'cash'}
                        onChange={event => setEditExpense(draft => draft && { ...draft, paymentMethod: event.target.value })}>
                        <AccountOptions banks={banks} cards={cards} />
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="edit-expense-date">Date</label>
                    <input type="date" id="edit-expense-date" required value={editExpense?.date ?? ''}
                        onChange={event => setEditExpense(draft => draft && { ...draft, date: event.target.value })} />
                </div>
            </Modal>

            <Modal id="delete-confirmation-modal" title="Confirm Delete" small open={pendingDelete !== null} closeAction="close-delete"
                onClose={() => setPendingDelete(null)}
                footer={(
                    <>
                        <button type="button" data-action="confirm-delete" className="danger-button" onClick={confirmDelete}>
                            <span className="icon-enhanced"><Trash2 /></span>Delete
                        </button>
                        <button type="button" data-action="close-delete" className="secondary-button" onClick={() => setPendingDelete(null)}>
                            <span className="icon-enhanced"><X /></span>Cancel
                        </button>
                    </>
                )}>
                <p id="delete-confirmation-message">
                    {pendingDelete ? (
                        <>
                            Are you sure you want to delete this {pendingDelete.type} transaction?<br /><br />
                            {pendingDelete.label}: {pendingDelete.name}<br />
                            Amount: {formatRupees(pendingDelete.amount)}
                        </>
                    ) : 'Are you sure you want to delete this transaction?'}
                </p>
                <p className="warning-text">This action cannot be undone.</p>
            </Modal>
        </div>
    );
}
