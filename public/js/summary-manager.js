/**
 * Enhanced Summary Manager with Modern Dashboard UI
 * Displays financial summaries with visual cards and highlighted amounts
 */
class SummaryManager {
    constructor() {
        this.apiClient = window.apiClient;
    }

    async loadMonthlySummary() {
        try {
            const month = document.getElementById('summary-month').value;
            const year = document.getElementById('summary-year').value;

            if (!month || !year) {
                document.getElementById('summary-display').innerHTML = '<p class="error">Please select both month and year.</p>';
                return;
            }

            const data = await this.apiClient.get(`/api/monthly-summary?month=${month}&year=${year}`);
            this.displayMonthlySummary(data, month, year);
        } catch (error) {
            // Check if it's an authentication error
            if (error.message.includes('Authentication required') || error.message.includes('401')) {
                // User is not authenticated, redirect to login
                window.expenseTracker.isAuthenticated = false;
                window.expenseTracker.showAuthenticationForms();
                document.getElementById('summary-display').innerHTML = '<p class="error">Please log in to view your summary.</p>';
            } else {
                document.getElementById('summary-display').innerHTML = `<p class="error">Error loading summary: ${error.message}</p>`;
            }
        }
    }

    displayMonthlySummary(data, month, year) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(month) - 1];

        // Determine the correct time reference text
        let timeReference;
        if (data.isCurrentMonth) {
            timeReference = 'as of now';
        } else if (data.isMonthCompleted) {
            timeReference = `at End of ${monthName}`;
        } else {
            timeReference = `at End of ${monthName}`; // fallback
        }

        let html = `<h2 style="text-align: center; color: #495057; margin-bottom: 30px;">
            📊 ${monthName} ${year} Financial Summary
        </h2>`;

        // Check for no data message
        if (data.message) {
            let messageDetail = '';
            if (data.message.includes('Future')) {
                messageDetail = 'Cannot show data for future dates.';
            } else if (data.message.includes('before registration')) {
                messageDetail = 'You were not registered during this period.';
            } else if (data.message.includes('No transactions found')) {
                messageDetail = 'You were registered but haven\'t added any transactions or setup accounts for this month.';
            } else {
                messageDetail = 'No data available for the selected period.';
            }

            html += `<div class="summary">
                <h3 style="color: #666; text-align: center;">${data.message}</h3>
                <p style="text-align: center; color: #999; margin-bottom: 20px;">
                    ${messageDetail}
                </p>
                ${data.message.includes('No transactions found') ? `
                    <div style="text-align: center;">
                        <button class="primary-button setup-accounts-btn" style="margin-right: 10px;">
                            Setup Accounts
                        </button>
                        <button class="primary-button add-transactions-btn">
                            Add Transactions
                        </button>
                    </div>
                ` : ''}
            </div>`;
            document.getElementById('summary-display').innerHTML = html;

            // Add event listeners for the action buttons (CSP-compliant)
            if (data.message.includes('No transactions found')) {
                this.attachActionButtonListeners();
            }
            return;
        }

        // Financial Dashboard Cards
        html += '<div class="summary-dashboard">';

        // Income Card
        if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
            html += `
                <div class="summary-card income">
                    <h3>💰 Monthly Income</h3>
                    <div class="summary-amount">₹${parseFloat(data.monthlyIncome).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="summary-subtitle">Money earned this month</div>
                </div>`;
        } else {
            html += `
                <div class="summary-card income" style="opacity: 0.6;">
                    <h3>💰 Monthly Income</h3>
                    <div class="summary-amount">₹0.00</div>
                    <div class="summary-subtitle">No income data available</div>
                </div>`;
        }

        // Expenses Card
        if (data.totalExpenses !== undefined && data.totalExpenses !== null) {
            html += `
                <div class="summary-card expense">
                    <h3>💸 Monthly Expenses</h3>
                    <div class="summary-amount">₹${parseFloat(data.totalExpenses).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="summary-subtitle">Money spent this month</div>
                </div>`;
        } else {
            html += `
                <div class="summary-card expense" style="opacity: 0.6;">
                    <h3>💸 Monthly Expenses</h3>
                    <div class="summary-amount">₹0.00</div>
                    <div class="summary-subtitle">No expense data available</div>
                </div>`;
        }

        // Total Wealth Card
        if (data.totalCurrentWealth !== undefined && data.totalCurrentWealth !== null) {
            html += `
                <div class="summary-card wealth">
                    <h3>💎 Total Wealth</h3>
                    <div class="summary-amount">₹${parseFloat(data.totalCurrentWealth).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="summary-subtitle">Banks + Cash ${timeReference}</div>
                </div>`;
        } else {
            html += `
                <div class="summary-card wealth" style="opacity: 0.6;">
                    <h3>💎 Total Wealth</h3>
                    <div class="summary-amount">₹0.00</div>
                    <div class="summary-subtitle">Unable to calculate wealth</div>
                </div>`;
        }

        // Net Savings Card
        if (data.netSavings !== undefined && data.netSavings !== null) {
            const savingsIcon = parseFloat(data.netSavings) >= 0 ? '📈' : '📉';
            html += `
                <div class="summary-card savings">
                    <h3>${savingsIcon} Net Savings</h3>
                    <div class="summary-amount">₹${parseFloat(data.netSavings).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="summary-subtitle">Income - Expenses + Initial</div>
                </div>`;
        } else {
            html += `
                <div class="summary-card savings" style="opacity: 0.6;">
                    <h3>📊 Net Savings</h3>
                    <div class="summary-amount">₹0.00</div>
                    <div class="summary-subtitle">Unable to calculate savings</div>
                </div>`;
        }

        html += '</div>'; // Close summary-dashboard

        // Account Balances Section
        html += '<div class="accounts-section">';
        html += `<h3 style="color: #495057; margin-bottom: 20px;">💳 Account Balances ${timeReference}</h3>`;
        html += '<div class="accounts-grid">';

        // Cash Balance
        if (data.cash) {
            const cashBalance = data.cash.balance;
            if (cashBalance !== undefined && cashBalance !== null && !isNaN(cashBalance)) {
                html += `
                    <div class="account-card cash">
                        <h4>💵 Cash Balance</h4>
                        <div class="account-balance">₹${parseFloat(cashBalance).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>`;
            } else {
                html += `
                    <div class="account-card cash" style="opacity: 0.6;">
                        <h4>💵 Cash Balance</h4>
                        <div class="account-balance" style="color: #6c757d;">Unavailable</div>
                    </div>`;
            }
        }

        // Bank Balances
        if (data.banks && data.banks.length > 0) {
            data.banks.forEach(bank => {
                const bankName = bank.name || 'Unknown Bank';
                const balance = bank.current_balance;
                if (balance !== undefined && balance !== null) {
                    html += `
                        <div class="account-card bank">
                            <h4>🏦 ${bankName}</h4>
                            <div class="account-balance">₹${parseFloat(balance).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>`;
                } else {
                    html += `
                        <div class="account-card bank" style="opacity: 0.6;">
                            <h4>🏦 ${bankName}</h4>
                            <div class="account-balance" style="color: #6c757d;">Unavailable</div>
                        </div>`;
                }
            });
        }

        // Credit Cards (only show if user tracks expenses or both)
        if (data.trackingOption === 'expenses' || data.trackingOption === 'both') {
            if (data.creditCards && data.creditCards.length > 0) {
                data.creditCards.forEach(card => {
                    const cardName = card.name || 'Unknown Card';
                    const creditLimit = card.credit_limit || 0;
                    const usedLimit = card.current_balance || 0;
                    const availableCredit = parseFloat(creditLimit) - parseFloat(usedLimit);

                    html += `
                        <div class="account-card credit">
                            <h4>💳 ${cardName}</h4>
                            <div class="account-balance" style="color: #dc3545;">₹${parseFloat(usedLimit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} used</div>
                            <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">
                                ₹${availableCredit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} available of ₹${parseFloat(creditLimit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                        </div>`;
                });
            }
        }

        html += '</div>'; // Close accounts-grid
        html += '</div>'; // Close accounts-section

        // Breakdown Details (Collapsible)
        if (data.netSavings !== undefined && data.netSavings !== null &&
            data.totalInitialBalance !== undefined && data.monthlyIncome !== undefined &&
            data.totalExpenses !== undefined) {
            html += `
                <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                    <h4 style="color: #495057; margin-bottom: 10px;">📋 Calculation Breakdown</h4>
                    <div style="font-size: 14px; color: #6c757d; line-height: 1.6;">
                        <strong>Net Savings Formula</strong><br>
                        Initial Balance (₹${parseFloat(data.totalInitialBalance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}) + 
                        Income (₹${parseFloat(data.monthlyIncome || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}) - 
                        Expenses (₹${parseFloat(data.totalExpenses || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}) = 
                        <strong>₹${parseFloat(data.netSavings).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                </div>`;
        }

        document.getElementById('summary-display').innerHTML = html;
    }

    attachActionButtonListeners() {
        // Add event listeners for action buttons in no-transactions message
        const summaryDisplay = document.getElementById('summary-display');
        if (summaryDisplay) {
            const setupBtn = summaryDisplay.querySelector('.setup-accounts-btn');
            const transactionsBtn = summaryDisplay.querySelector('.add-transactions-btn');

            if (setupBtn) {
                setupBtn.addEventListener('click', () => {
                    if (window.showSection) {
                        window.showSection('setup');
                    }
                });
            }

            if (transactionsBtn) {
                transactionsBtn.addEventListener('click', () => {
                    if (window.showSection) {
                        window.showSection('transactions');
                    }
                });
            }
        }
    }
}

// Global summary manager instance
window.summaryManager = new SummaryManager();
// Global summary manager instance
window.summaryManager = new SummaryManager();
