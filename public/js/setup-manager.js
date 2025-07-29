/**
 * Setup Manager Module
 * Handles bank, credit card, and cash balance setup
 */

class SetupManager {
    constructor() {
        this.apiClient = window.apiClient;
    }

    // Helper methods for showing messages
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = 'error';
            element.textContent = message;
            element.style.display = 'block'; // Ensure it's visible
        }
    }

    showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = 'success';
            element.textContent = message;
            element.style.display = 'block'; // Ensure it's visible
        }
    }

    clearMessage(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.className = 'error'; // Reset to default class
            element.style.display = 'none'; // Hide when empty
        }
    }

    async loadSetupData() {
        await Promise.all([
            this.loadBanks(),
            this.loadCreditCards(),
            this.loadCashBalance()
        ]);
        this.updateCreditCardVisibility();
        this.attachInputListeners();
    }

    attachInputListeners() {
        // Clear bank message when user starts typing
        const bankNameInput = document.getElementById('bank-name');
        const bankBalanceInput = document.getElementById('bank-balance');
        if (bankNameInput) {
            bankNameInput.addEventListener('input', () => this.clearMessage('bank-message'));
        }
        if (bankBalanceInput) {
            bankBalanceInput.addEventListener('input', () => this.clearMessage('bank-message'));
        }

        // Clear credit card message when user starts typing
        const ccNameInput = document.getElementById('cc-name');
        const ccLimitInput = document.getElementById('cc-limit');
        if (ccNameInput) {
            ccNameInput.addEventListener('input', () => this.clearMessage('credit-card-message'));
        }
        if (ccLimitInput) {
            ccLimitInput.addEventListener('input', () => this.clearMessage('credit-card-message'));
        }

        // Clear cash message when user starts typing
        const cashBalanceInput = document.getElementById('cash-balance');
        if (cashBalanceInput) {
            cashBalanceInput.addEventListener('input', () => this.clearMessage('cash-message'));
        }
    }

    updateCreditCardVisibility() {
        const ccSetup = document.getElementById('credit-card-setup');
        if (window.expenseTracker.trackingOption === 'income') {
            ccSetup.classList.add('hidden');
        } else {
            ccSetup.classList.remove('hidden');
        }
    }

    async addBank() {
        const name = document.getElementById('bank-name').value.trim();
        const balance = document.getElementById('bank-balance').value;

        // Clear previous messages
        this.clearMessage('bank-message');

        if (!name) {
            this.showError('bank-message', 'Please enter bank name');
            return;
        }

        // Validate balance if provided
        if (balance && (isNaN(balance) || parseFloat(balance) < 0)) {
            this.showError('bank-message', 'Please enter a valid initial balance (0 or greater)');
            return;
        }

        try {
            await this.apiClient.post('/api/banks', {
                name,
                initialBalance: balance ? parseFloat(balance) : 0
            });

            document.getElementById('bank-name').value = '';
            document.getElementById('bank-balance').value = '';
            this.showSuccess('bank-message', 'Bank added successfully');
            this.loadBanks();
            // Clear success message after 3 seconds
            setTimeout(() => this.clearMessage('bank-message'), 3000);
        } catch (error) {
            console.error('Error adding bank:', error);
            this.showError('bank-message', error.message || 'Error adding bank');
        }
    }

    async loadBanks() {
        try {
            const banks = await this.apiClient.get('/api/banks');

            const banksDiv = document.getElementById('banks-list');
            banksDiv.innerHTML = '<h4>Your Banks:</h4>';

            if (banks.length === 0) {
                banksDiv.innerHTML += '<p>No banks added yet.</p>';
            } else {
                const table = document.createElement('table');
                table.innerHTML = `
                    <tr>
                        <th>Bank Name</th>
                        <th>Initial Balance</th>
                        <th>Current Balance</th>
                    </tr>
                `;

                banks.forEach(bank => {
                    const row = table.insertRow();
                    row.innerHTML = `
                        <td>${bank.name}</td>
                        <td>₹${parseFloat(bank.initial_balance).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td>₹${parseFloat(bank.current_balance).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    `;
                });

                banksDiv.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading banks:', error);
        }
    }

    async addCreditCard() {
        const name = document.getElementById('cc-name').value.trim();
        const limit = document.getElementById('cc-limit').value;

        // Clear previous messages
        this.clearMessage('credit-card-message');

        if (!name) {
            this.showError('credit-card-message', 'Please enter card name');
            return;
        }

        if (!limit || isNaN(limit) || parseFloat(limit) <= 0) {
            this.showError('credit-card-message', 'Please enter a valid credit limit greater than 0');
            return;
        }

        try {
            const response = await this.apiClient.post('/api/credit-cards', {
                name,
                creditLimit: parseFloat(limit)
            });

            if (response.success !== false) {
                document.getElementById('cc-name').value = '';
                document.getElementById('cc-limit').value = '';
                this.showSuccess('credit-card-message', 'Credit card added successfully');
                this.loadCreditCards();
                // Clear success message after 3 seconds
                setTimeout(() => this.clearMessage('credit-card-message'), 3000);
            } else {
                this.showError('credit-card-message', response.error);
            }
        } catch (error) {
            console.error('Error adding credit card:', error);
            this.showError('credit-card-message', error.message || 'Error adding credit card');
        }
    }

    async loadCreditCards() {
        try {
            const cards = await this.apiClient.get('/api/credit-cards');

            const cardsDiv = document.getElementById('credit-cards-list');
            cardsDiv.innerHTML = '<h4>Your Credit Cards:</h4>';

            if (cards.length === 0) {
                cardsDiv.innerHTML += '<p>No credit cards added yet.</p>';
            } else {
                const table = document.createElement('table');
                table.innerHTML = `
                    <tr>
                        <th>Card Name</th>
                        <th>Credit Limit</th>
                        <th>Used Limit</th>
                        <th>Available</th>
                    </tr>
                `;

                cards.forEach(card => {
                    const row = table.insertRow();
                    const available = parseFloat(card.credit_limit) - parseFloat(card.used_limit);
                    row.innerHTML = `
                        <td>${card.name}</td>
                        <td>₹${parseFloat(card.credit_limit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td>₹${parseFloat(card.used_limit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td>₹${available.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    `;
                });

                cardsDiv.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading credit cards:', error);
        }
    }

    async setCashBalance() {
        const balance = document.getElementById('cash-balance').value;

        // Clear previous messages
        this.clearMessage('cash-message');

        // Validate balance if provided
        if (balance && (isNaN(balance) || parseFloat(balance) < 0)) {
            this.showError('cash-message', 'Please enter a valid cash balance (0 or greater)');
            return;
        }

        try {
            await this.apiClient.post('/api/cash-balance', {
                balance: balance ? parseFloat(balance) : 0
            });

            document.getElementById('cash-balance').value = '';
            this.showSuccess('cash-message', 'Cash balance updated successfully');
            this.loadCashBalance();
            // Clear success message after 3 seconds
            setTimeout(() => this.clearMessage('cash-message'), 3000);
        } catch (error) {
            console.error('Error setting cash balance:', error);
            this.showError('cash-message', error.message || 'Error setting cash balance');
        }
    }

    async loadCashBalance() {
        try {
            const cashData = await this.apiClient.get('/api/cash-balance');

            const cashDiv = document.getElementById('cash-display');
            cashDiv.innerHTML = `<h4>Cash Balance: ₹${parseFloat(cashData.balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h4>`;
        } catch (error) {
            console.error('Error loading cash balance:', error);
        }
    }
}

// Global setup manager instance
window.setupManager = new SetupManager();
// Global setup manager instance
window.setupManager = new SetupManager();
