/**
 * Transaction Manager Module
 * Handles income and expense transactions
 */

class TransactionManager {
    constructor() {
        this.apiClient = window.apiClient;
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

        try {
            const params = new URLSearchParams();
            params.append('month', month);
            params.append('year', year);

            const [incomeData, expenseData] = await Promise.all([
                this.apiClient.get(`/api/income?${params.toString()}`),
                this.apiClient.get(`/api/expenses?${params.toString()}`)
            ]);

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
                <td colspan="4" style="text-align: center; color: #666; font-style: italic; padding: 20px;">
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
                <td colspan="4" style="text-align: center; color: #666; font-style: italic; padding: 20px;">
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


}

// Global transaction manager instance
window.transactionManager = new TransactionManager();

// Global functions for onclick handlers
function filterTransactions() {
    window.transactionManager.filterTransactions();
}
