/**
 * Transaction Manager Module
 * Handles income and expense transactions
 */

class TransactionManager {
    constructor() {
        this.apiClient = window.apiClient;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Event delegation for transaction action buttons
        document.addEventListener('click', (event) => {
            const target = event.target;

            // Handle buttons with data-action attributes
            if (target.hasAttribute('data-action')) {
                const action = target.getAttribute('data-action');
                const id = parseInt(target.getAttribute('data-id'));

                console.log('Action button clicked:', action, 'ID:', id);

                switch(action) {
                case 'edit-income':
                    this.editIncomeTransaction(id);
                    break;
                case 'delete-income':
                    this.deleteIncomeTransaction(id);
                    break;
                case 'edit-expense':
                    this.editExpenseTransaction(id);
                    break;
                case 'delete-expense':
                    this.deleteExpenseTransaction(id);
                    break;
                case 'save-income-edit':
                    this.saveIncomeEdit();
                    break;
                case 'save-expense-edit':
                    this.saveExpenseEdit();
                    break;
                case 'confirm-delete':
                    this.confirmDelete();
                    break;
                case 'close-edit-income':
                    this.closeEditIncomeModal();
                    break;
                case 'close-edit-expense':
                    this.closeEditExpenseModal();
                    break;
                case 'close-delete':
                    this.closeDeleteModal();
                    break;
                }
            }
        });
    }

    async loadPaymentOptions() {
        try {
            const [banks, cards] = await Promise.all([
                this.apiClient.get('/api/banks'),
                this.apiClient.get('/api/credit-cards')
            ]);

            // Update income credited to options
            const incomeSelect = document.getElementById('income-credited-to');
            incomeSelect.innerHTML = '<option value="cash">Cash</option>';

            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = `bank-${bank.id}`;
                option.textContent = bank.name;
                incomeSelect.appendChild(option);
            });

            // Update expense payment method options
            const expenseSelect = document.getElementById('expense-payment-method');
            expenseSelect.innerHTML = '<option value="cash">Cash</option>';

            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = `bank-${bank.id}`;
                option.textContent = bank.name;
                expenseSelect.appendChild(option);
            });

            cards.forEach(card => {
                const option = document.createElement('option');
                option.value = `credit_card-${card.id}`;
                option.textContent = card.name;
                expenseSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading payment options:', error);
        }
    }

    async addIncome() {
        const source = document.getElementById('income-source').value;
        const amount = document.getElementById('income-amount').value;
        const creditedTo = document.getElementById('income-credited-to').value;
        const date = document.getElementById('income-date').value;

        if (!source || !amount || !date) {
            this.showTransactionMessage('Please fill all fields', 'error');
            return;
        }

        let creditedToType, creditedToId;
        if (creditedTo === 'cash') {
            creditedToType = 'cash';
            creditedToId = null;
        } else {
            [creditedToType, creditedToId] = creditedTo.split('-');
        }

        try {
            const response = await this.apiClient.post('/api/income', {
                source,
                amount: parseFloat(amount),
                creditedToType,
                creditedToId,
                date
            });

            if (response.success !== false) {
                document.getElementById('income-source').value = '';
                document.getElementById('income-amount').value = '';
                this.showTransactionMessage('Income added successfully!', 'success');
                window.setupManager.loadSetupData(); // Refresh balances
                this.loadTransactions(); // Refresh transactions
            } else {
                this.showTransactionMessage(response.error, 'error');
            }
        } catch (error) {
            console.error('Error adding income:', error);
            // Check if it's an authentication error
            if (error.message.includes('Authentication required') || error.message.includes('401')) {
                window.expenseTracker.isAuthenticated = false;
                window.expenseTracker.showAuthenticationForms();
                this.showTransactionMessage('Please log in to add income.', 'error');
                return;
            }
            // Try to extract the actual error message from the API response
            let errorMessage = 'Error adding income';
            if (error && error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            this.showTransactionMessage(errorMessage, 'error');
        }
    }

    async addExpense() {
        const title = document.getElementById('expense-title').value;
        const amount = document.getElementById('expense-amount').value;
        const paymentMethod = document.getElementById('expense-payment-method').value;
        const date = document.getElementById('expense-date').value;

        if (!title || !amount || !date) {
            this.showTransactionMessage('Please fill all fields', 'error');
            return;
        }

        let paymentMethodType, paymentSourceId;
        if (paymentMethod === 'cash') {
            paymentMethodType = 'cash';
            paymentSourceId = null;
        } else {
            [paymentMethodType, paymentSourceId] = paymentMethod.split('-');
        }

        try {
            const response = await this.apiClient.post('/api/expenses', {
                title,
                amount: parseFloat(amount),
                paymentMethod: paymentMethodType,
                paymentSourceId,
                date
            });

            if (response.success !== false) {
                document.getElementById('expense-title').value = '';
                document.getElementById('expense-amount').value = '';
                this.showTransactionMessage('Expense added successfully!', 'success');
                window.setupManager.loadSetupData(); // Refresh balances
                this.loadTransactions(); // Refresh transactions
            } else {
                this.showTransactionMessage(response.error, 'error');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            // Check if it's an authentication error
            if (error.message.includes('Authentication required') || error.message.includes('401')) {
                window.expenseTracker.isAuthenticated = false;
                window.expenseTracker.showAuthenticationForms();
                this.showTransactionMessage('Please log in to add expenses.', 'error');
                return;
            }
            // Try to extract the actual error message from the API response
            let errorMessage = 'Error adding expense';
            if (error && error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            this.showTransactionMessage(errorMessage, 'error');
        }
    }

    showTransactionMessage(message, type) {
        const messageElement = document.getElementById('transactions-message');
        if (messageElement) {
            messageElement.className = type;
            messageElement.textContent = message;

            // Auto-clear success messages after 5 seconds
            if (type === 'success') {
                setTimeout(() => {
                    messageElement.textContent = '';
                    messageElement.className = '';
                }, 5000);
            }
        }
    }

    async loadTransactions() {
        // Use selected month/year from filters, or default to current month/year
        const currentDate = new Date();
        const month = this.selectedMonth || currentDate.getMonth() + 1;
        const year = this.selectedYear || currentDate.getFullYear();

        console.log('Loading transactions for month:', month, 'year:', year);

        try {
            const params = new URLSearchParams();
            params.append('month', month);
            params.append('year', year);

            const [incomeData, expenseData] = await Promise.all([
                this.apiClient.get(`/api/income?${params.toString()}`),
                this.apiClient.get(`/api/expenses?${params.toString()}`)
            ]);

            console.log('Loaded income data:', incomeData);
            console.log('Loaded expense data:', expenseData);

            this.displayIncomeHistory(incomeData);
            this.displayExpenseHistory(expenseData);
            this.updateTransactionFormVisibility();

        } catch (error) {
            console.error('Error loading transactions:', error);
            // Check if it's an authentication error
            if (error.message.includes('Authentication required') || error.message.includes('401')) {
                window.expenseTracker.isAuthenticated = false;
                window.expenseTracker.showAuthenticationForms();
            }
            if (window.showError) {
                window.showError('Failed to load transactions. Please try again.');
            }
        }
    }

    displayIncomeHistory(incomeData) {
        const incomeTableBody = document.getElementById('income-table-body');
        incomeTableBody.innerHTML = '';

        if (incomeData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" style="text-align: center; color: #666; font-style: italic; padding: 20px;">
                    No income transactions found for this period
                </td>
            `;
            incomeTableBody.appendChild(row);
        } else {
            incomeData.forEach(income => {
                const row = document.createElement('tr');
                const date = new Date(income.date).toLocaleDateString();
                const creditedTo = income.credited_to_type === 'bank' ?
                    document.querySelector(`#income-credited-to option[value="bank-${income.credited_to_id}"]`)?.textContent || 'Unknown Bank' :
                    'Cash';

                row.innerHTML = `
                    <td>${date}</td>
                    <td>${income.source}</td>
                    <td>₹${parseFloat(income.amount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>${creditedTo}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" data-action="edit-income" data-id="${income.id}">
                                ✏️ Edit
                            </button>
                            <button class="action-btn delete-btn" data-action="delete-income" data-id="${income.id}">
                                🗑️ Delete
                            </button>
                        </div>
                    </td>
                `;
                incomeTableBody.appendChild(row);
            });
        }
    }

    displayExpenseHistory(expenseData) {
        const expenseTableBody = document.getElementById('expense-table-body');
        expenseTableBody.innerHTML = '';

        if (expenseData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" style="text-align: center; color: #666; font-style: italic; padding: 20px;">
                    No expense transactions found for this period
                </td>
            `;
            expenseTableBody.appendChild(row);
        } else {
            expenseData.forEach(expense => {
                const row = document.createElement('tr');
                const date = new Date(expense.date).toLocaleDateString();
                let paymentMethod = expense.payment_method;
                if (paymentMethod === 'bank' || paymentMethod === 'credit_card') {
                    const select = document.querySelector(`#expense-payment-method option[value="${paymentMethod}-${expense.payment_source_id}"]`);
                    paymentMethod = select ? select.textContent : 'Unknown Source';
                } else {
                    paymentMethod = 'Cash';
                }

                row.innerHTML = `
                    <td>${date}</td>
                    <td>${expense.title}</td>
                    <td>₹${parseFloat(expense.amount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>${paymentMethod}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" data-action="edit-expense" data-id="${expense.id}">
                                ✏️ Edit
                            </button>
                            <button class="action-btn delete-btn" data-action="delete-expense" data-id="${expense.id}">
                                🗑️ Delete
                            </button>
                        </div>
                    </td>
                `;
                expenseTableBody.appendChild(row);
            });
        }
    }

    updateTransactionFormVisibility() {
        const incomeForm = document.getElementById('income-form');
        const expenseForm = document.getElementById('expense-form');
        const incomeHistory = document.getElementById('income-history');
        const expenseHistory = document.getElementById('expense-history');

        const trackingOption = window.expenseTracker.trackingOption;

        if (trackingOption === 'income') {
            incomeForm.classList.remove('hidden');
            expenseForm.classList.add('hidden');
            incomeHistory.style.display = 'block';
            expenseHistory.style.display = 'none';
        } else if (trackingOption === 'expenses') {
            incomeForm.classList.add('hidden');
            expenseForm.classList.remove('hidden');
            incomeHistory.style.display = 'none';
            expenseHistory.style.display = 'block';
        } else {
            incomeForm.classList.remove('hidden');
            expenseForm.classList.remove('hidden');
            incomeHistory.style.display = 'block';
            expenseHistory.style.display = 'block';
        }
    }

    // Transaction filtering functionality
    initializeTransactionFilters() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Set current month as selected
        const monthSelect = document.getElementById('transaction-month');
        if (monthSelect) {
            monthSelect.value = currentMonth;
        }

        // Populate year dropdown (from 2020 to current year + 1)
        const yearSelect = document.getElementById('transaction-year');
        if (yearSelect) {
            yearSelect.innerHTML = '';
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) {
                    option.selected = true;
                }
                yearSelect.appendChild(option);
            }
        }

        this.selectedMonth = currentMonth;
        this.selectedYear = currentYear;
    }

    async filterTransactions() {
        const monthSelect = document.getElementById('transaction-month');
        const yearSelect = document.getElementById('transaction-year');

        if (!monthSelect || !yearSelect) {
            if (window.showError) {
                window.showError('Filter controls not found');
            }
            return;
        }

        this.selectedMonth = parseInt(monthSelect.value);
        this.selectedYear = parseInt(yearSelect.value);

        if (window.showInfo) {
            window.showInfo(`Loading transactions for ${monthSelect.options[monthSelect.selectedIndex].text} ${this.selectedYear}...`);
        }

        await this.loadTransactions();
    }

    // ===== CRUD OPERATIONS =====

    // Helper function to format date for input field
    formatDateForInput(dateString) {
        try {
            const date = new Date(dateString);
            // Get the date in local timezone and format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            // Fallback to today's date
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    // Edit Income Transaction
    async editIncomeTransaction(incomeId) {
        console.log('TransactionManager.editIncomeTransaction called with ID:', incomeId);
        try {
            // Fetch the income transaction details
            const income = await this.apiClient.get(`/api/income/${incomeId}`);
            console.log('Loaded income data:', income);

            // Store the income ID for saving
            this.editingIncomeId = incomeId;

            // Load payment options for the edit form first
            await this.loadEditPaymentOptions();

            // Populate the edit form after options are loaded
            document.getElementById('edit-income-source').value = income.source;
            document.getElementById('edit-income-amount').value = income.amount;

            // Debug the date formatting
            console.log('Original income.date:', income.date);
            console.log('Date after split:', income.date.split('T')[0]);
            const formattedDate = this.formatDateForInput(income.date);
            console.log('Formatted date:', formattedDate);
            document.getElementById('edit-income-date').value = formattedDate;

            // Set credited to value after dropdown is populated
            const creditedToValue = income.credited_to_type === 'cash' ? 'cash' : `${income.credited_to_type}-${income.credited_to_id}`;
            const creditedToSelect = document.getElementById('edit-income-credited-to');
            creditedToSelect.value = creditedToValue;

            console.log('Setting credited to value:', creditedToValue);
            console.log('Available options:', Array.from(creditedToSelect.options).map(opt => opt.value));

            // Show the modal
            document.getElementById('edit-income-modal').classList.remove('hidden');

        } catch (error) {
            console.error('Error loading income for edit:', error);
            if (window.showError) {
                window.showError('Failed to load income details for editing');
            }
        }
    }

    // Edit Expense Transaction
    async editExpenseTransaction(expenseId) {
        console.log('TransactionManager.editExpenseTransaction called with ID:', expenseId);
        try {
            // Fetch the expense transaction details
            const expense = await this.apiClient.get(`/api/expenses/${expenseId}`);
            console.log('Loaded expense data:', expense);

            // Store the expense ID for saving
            this.editingExpenseId = expenseId;

            // Load payment options for the edit form first
            await this.loadEditPaymentOptions();

            // Populate the edit form after options are loaded
            document.getElementById('edit-expense-title').value = expense.title;
            document.getElementById('edit-expense-amount').value = expense.amount;

            // Debug the date formatting
            console.log('Original expense.date:', expense.date);
            console.log('Date after split:', expense.date.split('T')[0]);
            const formattedDate = this.formatDateForInput(expense.date);
            console.log('Formatted date:', formattedDate);
            document.getElementById('edit-expense-date').value = formattedDate;

            // Set payment method value after dropdown is populated
            const paymentMethodValue = expense.payment_method === 'cash' ? 'cash' : `${expense.payment_method}-${expense.payment_source_id}`;
            const paymentMethodSelect = document.getElementById('edit-expense-payment-method');
            paymentMethodSelect.value = paymentMethodValue;

            console.log('Setting payment method value:', paymentMethodValue);
            console.log('Available options:', Array.from(paymentMethodSelect.options).map(opt => opt.value));

            // Show the modal
            document.getElementById('edit-expense-modal').classList.remove('hidden');

        } catch (error) {
            console.error('Error loading expense for edit:', error);
            if (window.showError) {
                window.showError('Failed to load expense details for editing');
            }
        }
    }    // Load payment options for edit forms
    async loadEditPaymentOptions() {
        try {
            const [banks, cards] = await Promise.all([
                this.apiClient.get('/api/banks'),
                this.apiClient.get('/api/credit-cards')
            ]);

            // Update edit income credited to options
            const editIncomeSelect = document.getElementById('edit-income-credited-to');
            editIncomeSelect.innerHTML = '<option value="cash">Cash</option>';

            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = `bank-${bank.id}`;
                option.textContent = bank.name;
                editIncomeSelect.appendChild(option);
            });

            // Update edit expense payment method options
            const editExpenseSelect = document.getElementById('edit-expense-payment-method');
            editExpenseSelect.innerHTML = '<option value="cash">Cash</option>';

            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = `bank-${bank.id}`;
                option.textContent = bank.name;
                editExpenseSelect.appendChild(option);
            });

            cards.forEach(card => {
                const option = document.createElement('option');
                option.value = `credit_card-${card.id}`;
                option.textContent = card.name;
                editExpenseSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading edit payment options:', error);
        }
    }

    // Save Income Edit
    async saveIncomeEdit() {
        const source = document.getElementById('edit-income-source').value;
        const amount = document.getElementById('edit-income-amount').value;
        const creditedTo = document.getElementById('edit-income-credited-to').value;
        const date = document.getElementById('edit-income-date').value;

        if (!source || !amount || !date) {
            if (window.showError) {
                window.showError('Please fill all fields');
            }
            return;
        }

        let creditedToType, creditedToId;
        if (creditedTo === 'cash') {
            creditedToType = 'cash';
            creditedToId = null;
        } else {
            [creditedToType, creditedToId] = creditedTo.split('-');
        }

        try {
            console.log('Saving income edit with data:', {
                source,
                amount: parseFloat(amount),
                creditedToType,
                creditedToId,
                date
            });

            const response = await this.apiClient.put(`/api/income/${this.editingIncomeId}`, {
                source,
                amount: parseFloat(amount),
                creditedToType,
                creditedToId,
                date
            });

            console.log('Income update response:', response);

            // Check if the transaction moved to a different month/year
            const editedDate = new Date(date);
            const editedMonth = editedDate.getMonth() + 1;
            const editedYear = editedDate.getFullYear();

            const currentMonth = this.selectedMonth || new Date().getMonth() + 1;
            const currentYear = this.selectedYear || new Date().getFullYear();

            // Close modal and refresh
            this.closeEditIncomeModal();
            if (window.showSuccess) {
                window.showSuccess('Income transaction updated successfully!');
            }
            window.setupManager.loadSetupData(); // Refresh balances

            // If the transaction moved to a different month/year, notify the user
            if (editedMonth !== currentMonth || editedYear !== currentYear) {
                if (window.showInfo) {
                    window.showInfo(`Transaction moved to ${editedDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}. Change filter to view it.`);
                }
            }

            this.loadTransactions(); // Refresh transactions

        } catch (error) {
            console.error('Error updating income:', error);
            if (window.showError) {
                window.showError('Failed to update income transaction');
            }
        }
    }

    // Save Expense Edit
    async saveExpenseEdit() {
        const title = document.getElementById('edit-expense-title').value;
        const amount = document.getElementById('edit-expense-amount').value;
        const paymentMethod = document.getElementById('edit-expense-payment-method').value;
        const date = document.getElementById('edit-expense-date').value;

        if (!title || !amount || !date) {
            if (window.showError) {
                window.showError('Please fill all fields');
            }
            return;
        }

        let paymentMethodType, paymentSourceId;
        if (paymentMethod === 'cash') {
            paymentMethodType = 'cash';
            paymentSourceId = null;
        } else {
            [paymentMethodType, paymentSourceId] = paymentMethod.split('-');
        }

        try {
            console.log('Saving expense edit with data:', {
                title,
                amount: parseFloat(amount),
                paymentMethod: paymentMethodType,
                paymentSourceId,
                date
            });

            const response = await this.apiClient.put(`/api/expenses/${this.editingExpenseId}`, {
                title,
                amount: parseFloat(amount),
                paymentMethod: paymentMethodType,
                paymentSourceId,
                date
            });

            console.log('Expense update response:', response);

            // Check if the transaction moved to a different month/year
            const editedDate = new Date(date);
            const editedMonth = editedDate.getMonth() + 1;
            const editedYear = editedDate.getFullYear();

            const currentMonth = this.selectedMonth || new Date().getMonth() + 1;
            const currentYear = this.selectedYear || new Date().getFullYear();

            // Close modal and refresh
            this.closeEditExpenseModal();
            if (window.showSuccess) {
                window.showSuccess('Expense transaction updated successfully!');
            }
            window.setupManager.loadSetupData(); // Refresh balances

            // If the transaction moved to a different month/year, notify the user
            if (editedMonth !== currentMonth || editedYear !== currentYear) {
                if (window.showInfo) {
                    window.showInfo(`Transaction moved to ${editedDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}. Change filter to view it.`);
                }
            }

            this.loadTransactions(); // Refresh transactions

        } catch (error) {
            console.error('Error updating expense:', error);
            if (window.showError) {
                window.showError('Failed to update expense transaction');
            }
        }
    }

    // Delete Income Transaction
    async deleteIncomeTransaction(incomeId) {
        try {
            // Get income details for confirmation message
            const income = await this.apiClient.get(`/api/income/${incomeId}`);

            this.deletingTransactionId = incomeId;
            this.deletingTransactionType = 'income';

            const message = `Are you sure you want to delete this income transaction?\n\nSource: ${income.source}\nAmount: ₹${parseFloat(income.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById('delete-confirmation-message').innerHTML = message.replace(/\n/g, '<br>');

            document.getElementById('delete-confirmation-modal').classList.remove('hidden');

        } catch (error) {
            console.error('Error loading income for delete:', error);
            if (window.showError) {
                window.showError('Failed to load income details');
            }
        }
    }

    // Delete Expense Transaction
    async deleteExpenseTransaction(expenseId) {
        try {
            // Get expense details for confirmation message
            const expense = await this.apiClient.get(`/api/expenses/${expenseId}`);

            this.deletingTransactionId = expenseId;
            this.deletingTransactionType = 'expense';

            const message = `Are you sure you want to delete this expense transaction?\n\nTitle: ${expense.title}\nAmount: ₹${parseFloat(expense.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById('delete-confirmation-message').innerHTML = message.replace(/\n/g, '<br>');

            document.getElementById('delete-confirmation-modal').classList.remove('hidden');

        } catch (error) {
            console.error('Error loading expense for delete:', error);
            if (window.showError) {
                window.showError('Failed to load expense details');
            }
        }
    }

    // Confirm Delete
    async confirmDelete() {
        try {
            if (this.deletingTransactionType === 'income') {
                await this.apiClient.delete(`/api/income/${this.deletingTransactionId}`);
                if (window.showSuccess) {
                    window.showSuccess('Income transaction deleted successfully!');
                }
            } else if (this.deletingTransactionType === 'expense') {
                await this.apiClient.delete(`/api/expenses/${this.deletingTransactionId}`);
                if (window.showSuccess) {
                    window.showSuccess('Expense transaction deleted successfully!');
                }
            }

            // Close modal and refresh
            this.closeDeleteModal();
            window.setupManager.loadSetupData(); // Refresh balances
            this.loadTransactions(); // Refresh transactions

        } catch (error) {
            console.error('Error deleting transaction:', error);
            if (window.showError) {
                window.showError('Failed to delete transaction');
            }
        }
    }

    // Modal control methods
    closeEditIncomeModal() {
        document.getElementById('edit-income-modal').classList.add('hidden');
        this.editingIncomeId = null;
    }

    closeEditExpenseModal() {
        document.getElementById('edit-expense-modal').classList.add('hidden');
        this.editingExpenseId = null;
    }

    closeDeleteModal() {
        document.getElementById('delete-confirmation-modal').classList.add('hidden');
        this.deletingTransactionId = null;
        this.deletingTransactionType = null;
    }


}

// Global transaction manager instance
window.transactionManager = new TransactionManager();

// Global functions for onclick handlers
function filterTransactions() {
    window.transactionManager.filterTransactions();
}

// CRUD operation global functions
function editIncomeTransaction(incomeId) {
    console.log('editIncomeTransaction called with ID:', incomeId);
    window.transactionManager.editIncomeTransaction(incomeId);
}

function editExpenseTransaction(expenseId) {
    console.log('editExpenseTransaction called with ID:', expenseId);
    window.transactionManager.editExpenseTransaction(expenseId);
}

function deleteIncomeTransaction(incomeId) {
    console.log('deleteIncomeTransaction called with ID:', incomeId);
    window.transactionManager.deleteIncomeTransaction(incomeId);
}

function deleteExpenseTransaction(expenseId) {
    console.log('deleteExpenseTransaction called with ID:', expenseId);
    window.transactionManager.deleteExpenseTransaction(expenseId);
}

function saveIncomeEdit() {
    window.transactionManager.saveIncomeEdit();
}

function saveExpenseEdit() {
    window.transactionManager.saveExpenseEdit();
}

function confirmDelete() {
    window.transactionManager.confirmDelete();
}

function closeEditIncomeModal() {
    window.transactionManager.closeEditIncomeModal();
}

function closeEditExpenseModal() {
    window.transactionManager.closeEditExpenseModal();
}

function closeDeleteModal() {
    window.transactionManager.closeDeleteModal();
}
