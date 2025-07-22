/**
 * Summary Manager Module
 * Handles monthly summary display and calculations
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
                document.getElementById('summary-display').innerHTML =
                    '<p style="color: #666; text-align: center;">Please select month and year to view summary</p>';
                return;
            }

            // Show loading message
            document.getElementById('summary-display').innerHTML =
                '<p style="color: #666; text-align: center;">Loading summary...</p>';

            const data = await this.apiClient.get(`/api/monthly-summary?month=${month}&year=${year}`);

            if (data && data.error) {
                throw new Error(data.error);
            }

            this.displayMonthlySummary(data, month, year);

        } catch (error) {
            console.error('Error loading monthly summary:', error);

            let errorMessage = 'Unknown error occurred';
            if (error && error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            // Check if it's an authentication error
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                document.getElementById('summary-display').innerHTML =
                    '<div class="error"><h3>Please log in</h3><p>You need to be logged in to view monthly summary. Please log in first.</p></div>';
            } else {
                document.getElementById('summary-display').innerHTML =
                    '<div class="error"><h3>Error loading monthly summary</h3><p>' + errorMessage + '</p></div>';
            }
        }
    }

    displayMonthlySummary(data, month, year) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(month) - 1];

        let html = `<h2>Monthly Summary - ${monthName} ${year}</h2>`;

        // Check for no data message
        if (data.message) {
            html += `<div class="summary">
                <h3 style="color: #666; text-align: center;">${data.message}</h3>
                <p style="text-align: center; color: #999;">
                    ${data.message.includes('Future') ?
        'Cannot show data for future dates.' :
        'You were not registered during this period.'}
                </p>
            </div>`;
            document.getElementById('summary-display').innerHTML = html;
            return;
        }

        // Financial Summary
        html += '<div class="summary">';

        // Income
        if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
            html += `<h3>This Month's Income: ${parseFloat(data.monthlyIncome).toFixed(2)}</h3>`;
        } else {
            html += '<h3 class="error">This Month\'s Income: No income data available</h3>';
        }

        // Total Wealth
        if (data.totalCurrentWealth !== undefined && data.totalCurrentWealth !== null) {
            html += `<h3>Total Wealth (Bank + Cash) at End of ${monthName}: ${parseFloat(data.totalCurrentWealth).toFixed(2)}</h3>`;
        } else {
            html += '<h3 class="error">Total Wealth: Unable to calculate wealth</h3>';
        }

        // Expenses
        if (data.totalExpenses !== undefined && data.totalExpenses !== null) {
            html += `<h3>This Month's Expenses: ${parseFloat(data.totalExpenses).toFixed(2)}</h3>`;
        } else {
            html += '<h3 class="error">This Month\'s Expenses: No expense data available</h3>';
        }

        // Net Savings with breakdown
        if (data.netSavings !== undefined && data.netSavings !== null &&
            data.totalInitialBalance !== undefined && data.monthlyIncome !== undefined &&
            data.totalExpenses !== undefined) {
            html += `<h3>Net Savings (Initial + Income - Expenses): ${parseFloat(data.netSavings).toFixed(2)}</h3>`;
            html += `<p style="color: #666; font-size: 14px;">Initial Balance: ${parseFloat(data.totalInitialBalance || 0).toFixed(2)} + Income: ${parseFloat(data.monthlyIncome || 0).toFixed(2)} - Expenses: ${parseFloat(data.totalExpenses || 0).toFixed(2)}</p>`;
        } else {
            html += '<h3 class="error">Net Savings: Unable to calculate savings</h3>';
        }

        html += '</div>';

        // Bank Balances (as they were at end of selected month)
        if (data.banks && data.banks.length > 0) {
            html += `<h3>Bank Balances at End of ${monthName} ${year}:</h3>`;
            html += '<table><tr><th>Bank</th><th>Balance</th></tr>';
            data.banks.forEach(bank => {
                const bankName = bank.name || 'Unknown Bank';
                const balance = bank.current_balance;
                if (balance === undefined || balance === null) {
                    html += `<tr><td>${bankName}</td><td class="error">Balance unavailable for this period</td></tr>`;
                } else {
                    html += `<tr><td>${bankName}</td><td>${parseFloat(balance).toFixed(2)}</td></tr>`;
                }
            });
            html += '</table>';
        } else {
            html += `<h3>Bank Balances: No banks configured in ${monthName} ${year}</h3>`;
        }

        // Cash Balance (as it was at end of selected month)
        if (data.cash) {
            const cashBalance = data.cash.balance;
            if (cashBalance === undefined || cashBalance === null || isNaN(cashBalance)) {
                html += `<h3 class="error">Cash Balance at End of ${monthName}: Balance unavailable for this period</h3>`;
            } else {
                html += `<h3>Cash Balance at End of ${monthName}: ${parseFloat(cashBalance).toFixed(2)}</h3>`;
            }
        } else {
            html += `<h3>Cash Balance: No cash balance configured in ${monthName} ${year}</h3>`;
        }

        // Credit Cards (as they were at that time)
        if (data.creditCards && data.creditCards.length > 0) {
            html += `<h3>Credit Cards in ${monthName} ${year}:</h3>`;
            html += '<table><tr><th>Card</th><th>Limit</th><th>Used</th><th>Available</th></tr>';
            data.creditCards.forEach(card => {
                const cardName = card.name || 'Unknown Card';
                const creditLimit = card.credit_limit;
                const usedLimit = card.used_limit;

                if (creditLimit === undefined || creditLimit === null ||
                    usedLimit === undefined || usedLimit === null) {
                    html += `<tr><td>${cardName}</td><td colspan="3" class="error">Card data unavailable</td></tr>`;
                } else {
                    const available = parseFloat(creditLimit) - parseFloat(usedLimit);
                    html += `<tr>
                        <td>${cardName}</td>
                        <td>${parseFloat(creditLimit).toFixed(2)}</td>
                        <td>${parseFloat(usedLimit).toFixed(2)}</td>
                        <td>${available.toFixed(2)}</td>
                    </tr>`;
                }
            });
            html += '</table>';
        } else {
            html += `<h3>Credit Cards: No credit cards configured in ${monthName} ${year}</h3>`;
        }

        document.getElementById('summary-display').innerHTML = html;
    }
}

// Global summary manager instance
window.summaryManager = new SummaryManager();
