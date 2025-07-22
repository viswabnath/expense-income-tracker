/**
 * Setup Manager Module
 * Handles bank, credit card, and cash balance setup
 */

class SetupManager {
    constructor() {
        this.apiClient = window.apiClient;
    }

    async loadSetupData() {
        await Promise.all([
            this.loadBanks(),
            this.loadCreditCards(),
            this.loadCashBalance()
        ]);
        this.updateCreditCardVisibility();
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
        const name = document.getElementById('bank-name').value;
        const balance = document.getElementById('bank-balance').value;
        
        if (!name) {
            alert('Please enter bank name');
            return;
        }
        
        try {
            const response = await this.apiClient.post('/api/banks', {
                name,
                initialBalance: balance || 0
            });
            
            if (response.success !== false) {
                document.getElementById('bank-name').value = '';
                document.getElementById('bank-balance').value = '';
                this.loadBanks();
            } else {
                alert(response.error);
            }
        } catch (error) {
            alert('Error adding bank');
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
                        <td>${parseFloat(bank.initial_balance).toFixed(2)}</td>
                        <td>${parseFloat(bank.current_balance).toFixed(2)}</td>
                    `;
                });
                
                banksDiv.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading banks:', error);
        }
    }

    async addCreditCard() {
        const name = document.getElementById('cc-name').value;
        const limit = document.getElementById('cc-limit').value;
        
        if (!name || !limit) {
            alert('Please enter card name and credit limit');
            return;
        }
        
        try {
            const response = await this.apiClient.post('/api/credit-cards', {
                name,
                creditLimit: limit
            });
            
            if (response.success !== false) {
                document.getElementById('cc-name').value = '';
                document.getElementById('cc-limit').value = '';
                this.loadCreditCards();
            } else {
                alert(response.error);
            }
        } catch (error) {
            alert('Error adding credit card');
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
                        <td>${parseFloat(card.credit_limit).toFixed(2)}</td>
                        <td>${parseFloat(card.used_limit).toFixed(2)}</td>
                        <td>${available.toFixed(2)}</td>
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
        
        try {
            await this.apiClient.post('/api/cash-balance', {
                balance: balance || 0
            });
            
            document.getElementById('cash-balance').value = '';
            this.loadCashBalance();
        } catch (error) {
            alert('Error setting cash balance');
        }
    }

    async loadCashBalance() {
        try {
            const cashData = await this.apiClient.get('/api/cash-balance');
            
            const cashDiv = document.getElementById('cash-display');
            cashDiv.innerHTML = `<h4>Cash Balance: ${parseFloat(cashData.balance || 0).toFixed(2)}</h4>`;
        } catch (error) {
            console.error('Error loading cash balance:', error);
        }
    }
}

// Global setup manager instance
window.setupManager = new SetupManager();
