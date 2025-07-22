/**
 * Summary Manager Module
 * Handles monthly summary display and calculations
 */

class SummaryManager {
    constructor() {
        this.apiClient = window.apiClient;
    }

    async loadMonthlySummary() {
        const month = document.getElementById('summary-month').value;
        const year = document.getElementById('summary-year').value;
        
        try {
            const data = await this.apiClient.get(`/api/monthly-summary?month=${month}&year=${year}`);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displaySummary(data);
            
        } catch (error) {
            console.error('Error loading monthly summary:', error);
            document.getElementById('summary-display').innerHTML = '<p>Error loading summary. Please try again.</p>';
        }
    }

    displaySummary(data) {
        const summaryDiv = document.getElementById('summary-display');
        const trackingOption = window.expenseTracker.trackingOption;
        
        let html = '<div class="summary">';
        
        // Income summary
        if (trackingOption === 'income' || trackingOption === 'both') {
            html += '<div class="income-summary">';
            
            if (data.monthlyIncome === undefined || data.monthlyIncome === null) {
                html += `<h3 class="error">This Month's Income: Error - No income data available</h3>`;
            } else {
                html += `<h3>This Month's Income: ${data.monthlyIncome.toFixed(2)}</h3>`;
            }
            
            if (data.totalCurrentWealth === undefined || data.totalCurrentWealth === null) {
                html += `<h3 class="error">Total Current Wealth: Error - Unable to calculate wealth</h3>`;
            } else {
                html += `<h3>Total Current Wealth (Bank + Cash): ${data.totalCurrentWealth.toFixed(2)}</h3>`;
            }
            
            html += '</div>';
        }
        
        // Expense summary
        if (trackingOption === 'expenses' || trackingOption === 'both') {
            if (data.totalExpenses === undefined || data.totalExpenses === null) {
                html += `<h3 class="error">This Month's Expenses: Error - No expense data available</h3>`;
            } else {
                html += `<h3>This Month's Expenses: ${data.totalExpenses.toFixed(2)}</h3>`;
            }
        }
        
        // Net savings (for both tracking)
        if (trackingOption === 'both') {
            if (data.netSavings === undefined || data.netSavings === null) {
                html += `<h3 class="error">Net Savings (Initial + Income - Expenses): Error - Unable to calculate savings</h3>`;
            } else {
                html += `<h3>Net Savings (Initial + Income - Expenses): ${data.netSavings.toFixed(2)}</h3>`;
            }
        }
        
        html += '</div>';
        
        // Banks
        html += this.generateBanksSummary(data.banks);
        
        // Cash
        html += this.generateCashSummary(data.cash);
        
        // Credit Cards
        html += this.generateCreditCardsSummary(data.creditCards);
        
        summaryDiv.innerHTML = html;
    }

    generateBanksSummary(banks) {
        if (banks && banks.length > 0) {
            let html = '<h3>Bank Balances:</h3>';
            html += '<table><tr><th>Bank</th><th>Balance</th></tr>';
            banks.forEach(bank => {
                const bankName = bank.name || 'Unknown Bank';
                const balance = bank.current_balance;
                if (balance === undefined || balance === null) {
                    html += `<tr><td>${bankName}</td><td class="error">Error - Balance unavailable</td></tr>`;
                } else {
                    html += `<tr><td>${bankName}</td><td>${parseFloat(balance).toFixed(2)}</td></tr>`;
                }
            });
            html += '</table>';
            return html;
        } else if (banks && banks.length === 0) {
            return '<h3>Bank Balances: No banks configured</h3>';
        } else {
            return '<h3 class="error">Bank Balances: Error loading bank data</h3>';
        }
    }

    generateCashSummary(cash) {
        if (cash) {
            const cashBalance = cash.balance;
            if (cashBalance === undefined || cashBalance === null || isNaN(parseFloat(cashBalance))) {
                return `<h3 class="error">Cash Balance: Error - Cash balance unavailable</h3>`;
            } else {
                return `<h3>Cash Balance: ${parseFloat(cashBalance).toFixed(2)}</h3>`;
            }
        } else {
            return `<h3>Cash Balance: 0.00 (No cash balance set)</h3>`;
        }
    }

    generateCreditCardsSummary(creditCards) {
        if (creditCards && creditCards.length > 0) {
            let html = '<h3>Credit Cards:</h3>';
            html += '<table><tr><th>Card</th><th>Limit</th><th>Used</th><th>Available</th></tr>';
            creditCards.forEach(card => {
                const cardName = card.name || 'Unknown Card';
                const creditLimit = card.credit_limit;
                const usedLimit = card.used_limit;
                
                if (creditLimit === undefined || creditLimit === null || usedLimit === undefined || usedLimit === null) {
                    html += `<tr><td>${cardName}</td><td class="error">Error</td><td class="error">Error</td><td class="error">Error</td></tr>`;
                } else {
                    const limit = parseFloat(creditLimit);
                    const used = parseFloat(usedLimit);
                    const available = limit - used;
                    html += `<tr><td>${cardName}</td><td>${limit.toFixed(2)}</td><td>${used.toFixed(2)}</td><td>${available.toFixed(2)}</td></tr>`;
                }
            });
            html += '</table>';
            return html;
        } else if (creditCards && creditCards.length === 0) {
            return '<h3>Credit Cards: No credit cards configured</h3>';
        } else {
            return '<h3 class="error">Credit Cards: Error loading credit card data</h3>';
        }
    }
}

// Global summary manager instance
window.summaryManager = new SummaryManager();
