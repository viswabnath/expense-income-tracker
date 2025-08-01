/**
 * Setup Manager Module
 * Handles bank, credit card, and cash balance setup
 */

class SetupManager {
    constructor() {
        this.apiClient = window.apiClient;
        this.init();
        this.setupEventDelegation();
    }

    setupEventDelegation() {
        // Event delegation for setup CRUD actions
        document.addEventListener('click', (event) => {
            const target = event.target;

            // Handle buttons with data-action attributes for setup operations
            if (target.hasAttribute('data-action')) {
                const action = target.getAttribute('data-action');
                const id = target.getAttribute('data-id');

                // Only handle setup-related actions
                if (action.includes('bank') || action.includes('credit-card') || action.includes('setup') || action.includes('cash')) {
                    console.log('Setup action clicked:', action, 'ID:', id);

                    this.handleSetupAction(action, { id });
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        });
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

    async init() {
        await this.loadSetupData();
    }

    async loadSetupData() {
        console.log('Loading setup data...');
        try {
            await Promise.all([
                this.loadBanks(),
                this.loadCreditCards(),
                this.loadCashBalance()
            ]);
            console.log('All setup data loaded');
            this.updateCreditCardVisibility();
            this.attachInputListeners();
        } catch (error) {
            console.error('Error in loadSetupData:', error);
        }
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
        if (ccSetup && window.expenseTracker && window.expenseTracker.trackingOption === 'income') {
            ccSetup.classList.add('hidden');
        } else if (ccSetup) {
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
            banksDiv.innerHTML = '';


            if (banks.length === 0) {
                banksDiv.innerHTML += '<p>No banks added yet.</p>';
            } else {
                const table = document.createElement('table');
                table.innerHTML = `
                    <tr>
                        <th>Bank Name</th>
                        <th>Initial Balance</th>
                        <th>Current Balance</th>
                        <th>Actions</th>
                    </tr>
                `;

                banks.forEach(bank => {
                    const row = table.insertRow();
                    row.innerHTML = `
                        <td>${bank.name}</td>
                        <td>₹${parseFloat(bank.initial_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₹${parseFloat(bank.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                            <button class="edit-btn" data-action="edit-bank" data-id="${bank.id}">Edit</button>
                            <button class="delete-btn" data-action="delete-bank" data-id="${bank.id}">Delete</button>
                        </td>
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
            cardsDiv.innerHTML = ''; // Clear previous content


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
                        <th>Actions</th>
                    </tr>
                `;

                cards.forEach(card => {
                    const row = table.insertRow();
                    const available = parseFloat(card.credit_limit) - parseFloat(card.used_limit);
                    row.innerHTML = `
                        <td>${card.name}</td>
                        <td>₹${parseFloat(card.credit_limit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₹${parseFloat(card.used_limit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₹${available.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                            <button class="edit-btn" data-action="edit-credit-card" data-id="${card.id}">Edit</button>
                            <button class="delete-btn" data-action="delete-credit-card" data-id="${card.id}">Delete</button>
                        </td>
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
            console.error('Error setting cash balance', error);
            this.showError('cash-message', error.message || 'Error setting cash balance');
        }
    }

    async loadCashBalance() {
        try {
            console.log('Loading cash balance...');
            const cashData = await this.apiClient.get('/api/cash-balance');
            console.log('Cash balance data received:', cashData);

            const cashDiv = document.getElementById('cash-display');
            if (!cashDiv) {
                console.error('cash-display element not found');
                return;
            }

            cashDiv.innerHTML = `
                <h4>Cash Balance</h4>
                <div class="cash-balance-display">
                    <span class="cash-amount">₹${parseFloat(cashData.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <button class="edit-btn" data-action="edit-cash-balance">Edit</button>
                </div>
            `;
            console.log('Cash balance display updated');
        } catch (error) {
            console.error('Error loading cash balance', error);
            // Fallback display in case of error
            const cashDiv = document.getElementById('cash-display');
            if (cashDiv) {
                cashDiv.innerHTML = `
                    <h4>Cash Balance</h4>
                    <div class="cash-balance-display">
                        <span class="cash-amount">₹0.00</span>
                        <button class="edit-btn" data-action="edit-cash-balance">Edit</button>
                    </div>
                `;
            }
        }
    }

    // Bank CRUD operations
    async editBank(bankId) {
        try {
            const banks = await this.apiClient.get('/api/banks');
            const bank = banks.find(b => b.id === parseInt(bankId));

            if (!bank) {
                window.toastManager.error('Bank not found');
                return;
            }

            // Populate modal with current bank data
            document.getElementById('edit-bank-name').value = bank.name;
            document.getElementById('edit-bank-balance').value = parseFloat(bank.initial_balance);

            // Store bank ID for saving
            document.getElementById('edit-bank-modal').dataset.bankId = bankId;

            // Show modal
            document.getElementById('edit-bank-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading bank data:', error);
            window.toastManager.error('Error loading bank data');
        }
    }

    async saveBank() {
        const modal = document.getElementById('edit-bank-modal');
        const bankId = modal.dataset.bankId;
        const name = document.getElementById('edit-bank-name').value.trim();
        const initialBalance = document.getElementById('edit-bank-balance').value;

        if (!name) {
            window.toastManager.error('Bank name is required');
            return;
        }

        if (!initialBalance || isNaN(initialBalance) || parseFloat(initialBalance) < 0) {
            window.toastManager.error('Valid initial balance is required');
            return;
        }

        try {
            await this.apiClient.put(`/api/banks/${bankId}`, {
                name,
                initialBalance: parseFloat(initialBalance)
            });

            window.toastManager.success('Bank updated successfully');
            this.loadBanks();
            this.closeEditBankModal();
        } catch (error) {
            console.error('Error updating bank:', error);
            window.toastManager.error(error.message || 'Error updating bank');
        }
    }

    async deleteBank(bankId) {
        // Show confirmation modal
        document.getElementById('delete-setup-message').textContent = 'Are you sure you want to delete this bank?';
        document.getElementById('delete-setup-modal').dataset.itemType = 'bank';
        document.getElementById('delete-setup-modal').dataset.itemId = bankId;
        document.getElementById('delete-setup-modal').classList.remove('hidden');
    }

    async confirmDeleteBank(bankId) {
        try {
            await this.apiClient.delete(`/api/banks/${bankId}`);
            window.toastManager.success('Bank deleted successfully');
            this.loadBanks();
            this.closeDeleteSetupModal();
        } catch (error) {
            console.error('Error deleting bank:', error);
            window.toastManager.error(error.message || 'Error deleting bank');
        }
    }

    // Credit Card CRUD operations
    async editCreditCard(cardId) {
        try {
            const cards = await this.apiClient.get('/api/credit-cards');
            const card = cards.find(c => c.id === parseInt(cardId));

            if (!card) {
                window.toastManager.error('Credit card not found');
                return;
            }

            // Populate modal with current card data
            document.getElementById('edit-credit-card-name').value = card.name;
            document.getElementById('edit-credit-card-limit').value = parseFloat(card.credit_limit);

            // Show used limit info
            const usedLimit = parseFloat(card.used_limit);
            document.getElementById('credit-card-used-info').innerHTML =
                `<strong>Current Used Limit:</strong> ₹${usedLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br>
                 <em>Credit limit must be at least this amount.</em>`;

            // Store card ID for saving
            document.getElementById('edit-credit-card-modal').dataset.cardId = cardId;

            // Show modal
            document.getElementById('edit-credit-card-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading credit card data:', error);
            window.toastManager.error('Error loading credit card data');
        }
    }

    async saveCreditCard() {
        const modal = document.getElementById('edit-credit-card-modal');
        const cardId = modal.dataset.cardId;
        const name = document.getElementById('edit-credit-card-name').value.trim();
        const creditLimit = document.getElementById('edit-credit-card-limit').value;

        if (!name) {
            window.toastManager.error('Card name is required');
            return;
        }

        if (!creditLimit || isNaN(creditLimit) || parseFloat(creditLimit) <= 0) {
            window.toastManager.error('Valid credit limit greater than 0 is required');
            return;
        }

        try {
            await this.apiClient.put(`/api/credit-cards/${cardId}`, {
                name,
                creditLimit: parseFloat(creditLimit)
            });

            window.toastManager.success('Credit card updated successfully');
            this.loadCreditCards();
            this.closeEditCreditCardModal();
        } catch (error) {
            console.error('Error updating credit card:', error);
            window.toastManager.error(error.message || 'Error updating credit card');
        }
    }

    async deleteCreditCard(cardId) {
        // Show confirmation modal
        document.getElementById('delete-setup-message').textContent = 'Are you sure you want to delete this credit card?';
        document.getElementById('delete-setup-modal').dataset.itemType = 'credit-card';
        document.getElementById('delete-setup-modal').dataset.itemId = cardId;
        document.getElementById('delete-setup-modal').classList.remove('hidden');
    }

    async confirmDeleteCreditCard(cardId) {
        try {
            await this.apiClient.delete(`/api/credit-cards/${cardId}`);
            window.toastManager.success('Credit card deleted successfully');
            this.loadCreditCards();
            this.closeDeleteSetupModal();
        } catch (error) {
            console.error('Error deleting credit card:', error);
            window.toastManager.error(error.message || 'Error deleting credit card');
        }
    }

    // Modal management methods
    closeEditBankModal() {
        document.getElementById('edit-bank-modal').classList.add('hidden');
        document.getElementById('edit-bank-form').reset();
    }

    closeEditCreditCardModal() {
        document.getElementById('edit-credit-card-modal').classList.add('hidden');
        document.getElementById('edit-credit-card-form').reset();
    }

    closeDeleteSetupModal() {
        document.getElementById('delete-setup-modal').classList.add('hidden');
    }

    closeEditCashModal() {
        document.getElementById('edit-cash-modal').classList.add('hidden');
        document.getElementById('edit-cash-form').reset();
    }

    // Cash balance CRUD operations
    async editCashBalance() {
        try {
            const cashData = await this.apiClient.get('/api/cash-balance');

            // Populate modal with current cash balance
            document.getElementById('edit-cash-balance').value = parseFloat(cashData.balance || 0);

            // Show modal
            document.getElementById('edit-cash-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading cash balance:', error);
            window.toastManager.error('Error loading cash balance');
        }
    }

    async saveCashBalance() {
        const balance = document.getElementById('edit-cash-balance').value;

        if (balance === '' || isNaN(balance) || parseFloat(balance) < 0) {
            window.toastManager.error('Please enter a valid cash balance (0 or greater)');
            return;
        }

        try {
            await this.apiClient.post('/api/cash-balance', {
                balance: parseFloat(balance)
            });

            window.toastManager.success('Cash balance updated successfully');
            this.loadCashBalance();
            this.closeEditCashModal();
        } catch (error) {
            console.error('Error updating cash balance:', error);
            window.toastManager.error(error.message || 'Error updating cash balance');
        }
    }

    // Handle setup CRUD actions
    async handleSetupAction(action, data) {
        switch (action) {
        case 'edit-bank':
            await this.editBank(data.id);
            break;
        case 'delete-bank':
            await this.deleteBank(data.id);
            break;
        case 'edit-credit-card':
            await this.editCreditCard(data.id);
            break;
        case 'delete-credit-card':
            await this.deleteCreditCard(data.id);
            break;
        case 'edit-cash-balance':
            await this.editCashBalance();
            break;
        case 'save-bank':
            await this.saveBank();
            break;
        case 'save-credit-card':
            await this.saveCreditCard();
            break;
        case 'save-cash-balance':
            await this.saveCashBalance();
            break;
        case 'confirm-delete-setup': {
            const modal = document.getElementById('delete-setup-modal');
            const itemType = modal.dataset.itemType;
            const itemId = modal.dataset.itemId;
            if (itemType === 'bank') {
                await this.confirmDeleteBank(itemId);
            } else if (itemType === 'credit-card') {
                await this.confirmDeleteCreditCard(itemId);
            }
            break;
        }
        case 'close-edit-bank':
            this.closeEditBankModal();
            break;
        case 'close-edit-credit-card':
            this.closeEditCreditCardModal();
            break;
        case 'close-edit-cash':
            this.closeEditCashModal();
            break;
        case 'close-delete-setup':
            this.closeDeleteSetupModal();
            break;
        }
    }
}

// Global setup manager instance
window.setupManager = new SetupManager();
