'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, Pencil, Save, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiDelete, apiGet, apiPost, apiPut, httpError, redirectIfUnauthorized } from '@/lib/api-client';
import { formatRupees } from '@/lib/format';
import { useFormMessage, type FormMessageState } from '@/components/useFormMessage';

interface Bank { id: number; name: string; initial_balance: string; current_balance: string }
interface Card { id: number; name: string; credit_limit: string; used_limit: string }
interface Cash { initial_balance?: string | number }

/** The legacy number checks: empty is allowed where the legacy form allowed it */
const isNegativeOrInvalid = (value: string) => value !== '' && (isNaN(Number(value)) || parseFloat(value) < 0);

/** Inline form message (#bank-message etc.): hidden when empty, like the legacy setup screen */
function FormMessage({ id, message }: { id: string; message: FormMessageState | null }) {
    return (
        <div id={id} className={message ? message.kind : 'error-msg'} style={{ display: message ? 'block' : 'none' }}>
            {message?.text ?? ''}
        </div>
    );
}

export function SetupScreen() {
    const toast = useToast();
    const [loaded, setLoaded] = useState(false);
    const [trackingOption, setTrackingOption] = useState('both');
    const [banks, setBanks] = useState<Bank[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [cash, setCash] = useState<Cash>({});

    const [bankName, setBankName] = useState('');
    const [bankBalance, setBankBalance] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardLimit, setCardLimit] = useState('');
    const [cashInput, setCashInput] = useState('');
    const bankMessage = useFormMessage(3000);
    const cardMessage = useFormMessage(3000);
    const cashMessage = useFormMessage(3000);

    const [editBank, setEditBank] = useState<{ id: number; name: string; balance: string } | null>(null);
    const [editCard, setEditCard] = useState<{ id: number; name: string; limit: string; used: string } | null>(null);
    const [editCash, setEditCash] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ type: 'bank' | 'credit-card'; id: number } | null>(null);

    const loadBanks = useCallback(async () => {
        const result = await apiGet<Bank[]>('/api/banks');
        if (redirectIfUnauthorized(result)) return;
        if (result.ok) setBanks(result.data);
    }, []);
    const loadCards = useCallback(async () => {
        const result = await apiGet<Card[]>('/api/credit-cards');
        if (redirectIfUnauthorized(result)) return;
        if (result.ok) setCards(result.data);
    }, []);
    const loadCash = useCallback(async () => {
        const result = await apiGet<Cash>('/api/cash-balance');
        if (redirectIfUnauthorized(result)) return;
        setCash(result.ok ? result.data : {});
    }, []);

    useEffect(() => {
        (async () => {
            const user = await apiGet<{ tracking_option?: string }>('/api/user');
            if (redirectIfUnauthorized(user)) return;
            setTrackingOption(user.data.tracking_option || 'both');
            await Promise.all([loadBanks(), loadCards(), loadCash()]);
            setLoaded(true);
        })();
    }, [loadBanks, loadCards, loadCash]);

    async function addBank() {
        bankMessage.clear();
        const name = bankName.trim();
        if (!name) return bankMessage.show('error', 'Please enter bank name');
        if (isNegativeOrInvalid(bankBalance)) return bankMessage.show('error', 'Please enter a valid initial balance (0 or greater)');
        const result = await apiPost('/api/banks', { name, initialBalance: bankBalance ? parseFloat(bankBalance) : 0 });
        if (!result.ok) return bankMessage.show('error', httpError(result));
        setBankName('');
        setBankBalance('');
        bankMessage.show('success', 'Bank added successfully');
        await loadBanks();
    }

    async function addCard() {
        cardMessage.clear();
        const name = cardName.trim();
        if (!name) return cardMessage.show('error', 'Please enter card name');
        if (!cardLimit || isNaN(Number(cardLimit)) || parseFloat(cardLimit) <= 0) {
            return cardMessage.show('error', 'Please enter a valid credit limit greater than 0');
        }
        const result = await apiPost('/api/credit-cards', { name, creditLimit: parseFloat(cardLimit) });
        if (!result.ok) return cardMessage.show('error', httpError(result));
        setCardName('');
        setCardLimit('');
        cardMessage.show('success', 'Credit card added successfully');
        await loadCards();
    }

    async function setCashBalance() {
        cashMessage.clear();
        if (isNegativeOrInvalid(cashInput)) return cashMessage.show('error', 'Please enter a valid cash balance (0 or greater)');
        const result = await apiPost('/api/cash-balance', { balance: cashInput ? parseFloat(cashInput) : 0 });
        if (!result.ok) return cashMessage.show('error', httpError(result));
        setCashInput('');
        cashMessage.show('success', 'Cash balance updated successfully');
        await loadCash();
    }

    async function saveBank() {
        if (!editBank) return;
        const name = editBank.name.trim();
        if (!name) return toast('error', 'Bank name is required');
        if (!editBank.balance || isNaN(Number(editBank.balance)) || parseFloat(editBank.balance) < 0) {
            return toast('error', 'Valid initial balance is required');
        }
        const result = await apiPut(`/api/banks/${editBank.id}`, { name, initialBalance: parseFloat(editBank.balance) });
        if (!result.ok) return toast('error', httpError(result));
        toast('success', 'Bank updated successfully');
        setEditBank(null);
        await loadBanks();
    }

    async function saveCard() {
        if (!editCard) return;
        const name = editCard.name.trim();
        if (!name) return toast('error', 'Card name is required');
        if (!editCard.limit || isNaN(Number(editCard.limit)) || parseFloat(editCard.limit) <= 0) {
            return toast('error', 'Valid credit limit greater than 0 is required');
        }
        const result = await apiPut(`/api/credit-cards/${editCard.id}`, { name, creditLimit: parseFloat(editCard.limit) });
        if (!result.ok) return toast('error', httpError(result));
        toast('success', 'Credit card updated successfully');
        setEditCard(null);
        await loadCards();
    }

    async function saveCash() {
        if (editCash === null) return;
        if (editCash === '' || isNaN(Number(editCash)) || parseFloat(editCash) < 0) {
            return toast('error', 'Please enter a valid cash balance (0 or greater)');
        }
        const value = parseFloat(editCash);
        const result = await apiPost('/api/cash-balance', { initial_balance: value, balance: value });
        if (!result.ok) return toast('error', httpError(result));
        toast('success', 'Cash balance updated successfully');
        setEditCash(null);
        await loadCash();
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        const isBank = pendingDelete.type === 'bank';
        const result = await apiDelete(isBank ? `/api/banks/${pendingDelete.id}` : `/api/credit-cards/${pendingDelete.id}`);
        if (!result.ok) return toast('error', httpError(result));
        toast('success', isBank ? 'Bank deleted successfully' : 'Credit card deleted successfully');
        setPendingDelete(null);
        await (isBank ? loadBanks() : loadCards());
    }

    if (!loaded) {
        // Rendered only after the data loads, so nothing can be typed before the form is live
        return null;
    }

    const initialCash = parseFloat(String(cash.initial_balance ?? 0)) || 0;
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

    return (
        <div id="setup-section">
            <h2>Account Setup</h2>

            <div id="bank-setup" className="setup-card">
                <h3>Bank Setup</h3>
                <div className="setup-body">
                    <div className="setup-left">
                        <div className="form-field">
                            <label htmlFor="bank-name">Bank Name</label>
                            <input type="text" id="bank-name" placeholder="e.g., HDFC, ICICI" value={bankName}
                                onChange={event => { setBankName(event.target.value); bankMessage.clear(); }} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="bank-balance">Initial Balance</label>
                            <input type="number" id="bank-balance" placeholder="0.00" step="0.01" value={bankBalance}
                                onChange={event => { setBankBalance(event.target.value); bankMessage.clear(); }} />
                        </div>
                        <button type="button" className="primary-btn" data-action="addBank" onClick={addBank}><Landmark /> Add Bank</button>
                    </div>
                    <div className="setup-right" id="banks-list">
                        {banks.length === 0 ? <p>No banks added yet.</p> : (
                            <table>
                                <tbody>
                                    <tr><th>Bank Name</th><th>Initial Balance</th><th>Current Balance</th><th>Actions</th></tr>
                                    {banks.map(bank => (
                                        <tr key={bank.id}>
                                            <td>{bank.name}</td>
                                            <td>{formatRupees(bank.initial_balance)}</td>
                                            <td>{formatRupees(bank.current_balance)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button type="button" className="action-btn edit-btn" data-action="edit-bank" data-id={bank.id}
                                                        onClick={() => setEditBank({ id: bank.id, name: bank.name, balance: String(parseFloat(bank.initial_balance)) })}>
                                                        <Pencil /> Edit
                                                    </button>
                                                    <button type="button" className="action-btn delete-btn" data-action="delete-bank" data-id={bank.id}
                                                        onClick={() => setPendingDelete({ type: 'bank', id: bank.id })}>
                                                        <Trash2 /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
                <FormMessage id="bank-message" message={bankMessage.message} />
            </div>

            <div id="credit-card-setup" className={`setup-card${trackingOption === 'income' ? ' hidden' : ''}`}>
                <h3>Credit Card Setup</h3>
                <div className="setup-body">
                    <div className="setup-left">
                        <div className="form-field">
                            <label htmlFor="cc-name">Card Name</label>
                            <input type="text" id="cc-name" placeholder="e.g., SBI, HDFC Card" value={cardName}
                                onChange={event => { setCardName(event.target.value); cardMessage.clear(); }} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="cc-limit">Credit Limit</label>
                            <input type="number" id="cc-limit" placeholder="0.00" step="0.01" value={cardLimit}
                                onChange={event => { setCardLimit(event.target.value); cardMessage.clear(); }} />
                        </div>
                        <button type="button" className="primary-btn" data-action="addCreditCard" onClick={addCard}><CreditCard /> Add Credit Card</button>
                    </div>
                    <div id="credit-cards-list" className="setup-right">
                        {cards.length === 0 ? <p>No credit cards added yet.</p> : (
                            <table>
                                <tbody>
                                    <tr><th>Card Name</th><th>Credit Limit</th><th>Used Limit</th><th>Available</th><th>Actions</th></tr>
                                    {cards.map(card => (
                                        <tr key={card.id}>
                                            <td>{card.name}</td>
                                            <td>{formatRupees(card.credit_limit)}</td>
                                            <td>{formatRupees(card.used_limit)}</td>
                                            <td>{formatRupees(parseFloat(card.credit_limit) - parseFloat(card.used_limit))}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button type="button" className="action-btn edit-btn" data-action="edit-credit-card" data-id={card.id}
                                                        onClick={() => setEditCard({ id: card.id, name: card.name, limit: String(parseFloat(card.credit_limit)), used: card.used_limit })}>
                                                        <Pencil /> Edit
                                                    </button>
                                                    <button type="button" className="action-btn delete-btn" data-action="delete-credit-card" data-id={card.id}
                                                        onClick={() => setPendingDelete({ type: 'credit-card', id: card.id })}>
                                                        <Trash2 /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
                <FormMessage id="credit-card-message" message={cardMessage.message} />
            </div>

            <div id="cash-setup" className="setup-card">
                <h3>Cash Balance</h3>
                <div className="setup-body">
                    <div className="setup-left">
                        <div className="form-field">
                            <label htmlFor="cash-balance">Cash Balance</label>
                            <input type="number" id="cash-balance" placeholder="0.00" step="0.01" value={cashInput}
                                onChange={event => { setCashInput(event.target.value); cashMessage.clear(); }} />
                        </div>
                        <button type="button" className="primary-btn" data-action="setCashBalance" onClick={setCashBalance}><Banknote /> Set Cash Balance</button>
                    </div>
                    <div id="cash-display" className="setup-right-cash-balance">
                        <h4>Cash Balance</h4>
                        <div className="cash-balance-display">
                            <span className="cash-amount">{formatRupees(initialCash)}</span>
                            <button type="button" className="action-btn edit-btn" data-action="edit-cash-balance" disabled={initialCash === 0}
                                onClick={() => setEditCash(String(initialCash))}>
                                <Pencil /> Edit
                            </button>
                        </div>
                    </div>
                </div>
                <FormMessage id="cash-message" message={cashMessage.message} />
            </div>

            <Modal id="edit-bank-modal" title="Edit Bank" open={editBank !== null} closeAction="close-edit-bank" onClose={() => setEditBank(null)}
                footer={modalButtons('save-bank', 'close-edit-bank', saveBank, () => setEditBank(null))}>
                <form id="edit-bank-form" onSubmit={event => event.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="edit-bank-name">Bank Name:</label>
                        <input type="text" id="edit-bank-name" required value={editBank?.name ?? ''}
                            onChange={event => setEditBank(current => current && { ...current, name: event.target.value })} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-bank-balance">Initial Balance:</label>
                        <input type="number" id="edit-bank-balance" step="0.01" min="0" required value={editBank?.balance ?? ''}
                            onChange={event => setEditBank(current => current && { ...current, balance: event.target.value })} />
                    </div>
                    <div className="warning-text">
                        <strong>Note:</strong> Changing the initial balance will adjust the current balance by the difference.
                    </div>
                </form>
            </Modal>

            <Modal id="edit-credit-card-modal" title="Edit Credit Card" open={editCard !== null} closeAction="close-edit-credit-card" onClose={() => setEditCard(null)}
                footer={modalButtons('save-credit-card', 'close-edit-credit-card', saveCard, () => setEditCard(null))}>
                <form id="edit-credit-card-form" onSubmit={event => event.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="edit-credit-card-name">Card Name:</label>
                        <input type="text" id="edit-credit-card-name" required value={editCard?.name ?? ''}
                            onChange={event => setEditCard(current => current && { ...current, name: event.target.value })} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-credit-card-limit">Credit Limit:</label>
                        <input type="number" id="edit-credit-card-limit" step="0.01" min="0.01" required value={editCard?.limit ?? ''}
                            onChange={event => setEditCard(current => current && { ...current, limit: event.target.value })} />
                    </div>
                    <div id="credit-card-used-info" className="info-text">
                        {editCard ? (
                            <>
                                <strong>Current Used Limit:</strong> {formatRupees(editCard.used)}<br />
                                <em>Credit limit must be at least this amount.</em>
                            </>
                        ) : null}
                    </div>
                </form>
            </Modal>

            <Modal id="edit-cash-modal" title="Edit Cash Balance" open={editCash !== null} closeAction="close-edit-cash" onClose={() => setEditCash(null)}
                footer={modalButtons('save-cash-balance', 'close-edit-cash', saveCash, () => setEditCash(null))}>
                <form id="edit-cash-form" onSubmit={event => event.preventDefault()}>
                    <div className="form-group">
                        <label htmlFor="edit-cash-balance">Cash Balance:</label>
                        <input type="number" id="edit-cash-balance" step="0.01" min="0" required value={editCash ?? ''}
                            onChange={event => setEditCash(event.target.value)} />
                    </div>
                    <div className="info-text">
                        Update your current cash balance. This will replace the existing cash balance.
                    </div>
                </form>
            </Modal>

            <Modal id="delete-setup-modal" title="Confirm Deletion" open={pendingDelete !== null} closeAction="close-delete-setup" onClose={() => setPendingDelete(null)}
                footer={(
                    <>
                        <button type="button" data-action="confirm-delete-setup" className="danger-button" onClick={confirmDelete}>
                            <span className="icon-enhanced"><Trash2 /></span>Delete
                        </button>
                        <button type="button" data-action="close-delete-setup" className="secondary-button" onClick={() => setPendingDelete(null)}>
                            <span className="icon-enhanced"><X /></span>Cancel
                        </button>
                    </>
                )}>
                <p id="delete-setup-message">
                    {pendingDelete?.type === 'credit-card' ? 'Are you sure you want to delete this credit card?' : 'Are you sure you want to delete this bank?'}
                </p>
                <p className="warning-text">This action cannot be undone and will fail if there are related transactions.</p>
            </Modal>
        </div>
    );
}
