/**
 * API Client
 * Handles all API communications
 */

class ApiClient {
    static async request(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await fetch(endpoint, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    static async get(endpoint) {
        return this.request(endpoint);
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Auth endpoints
    static async login(credentials) {
        return this.post('/api/login', credentials);
    }

    static async register(userData) {
        return this.post('/api/register', userData);
    }

    static async forgotPassword(data) {
        return this.post('/api/forgot-password', data);
    }

    static async resetPassword(data) {
        return this.post('/api/reset-password', data);
    }

    static async logout() {
        return this.post('/api/logout');
    }

    // Setup endpoints
    static async getBanks() {
        return this.get('/api/banks');
    }

    static async addBank(bankData) {
        return this.post('/api/banks', bankData);
    }

    static async getCreditCards() {
        return this.get('/api/credit-cards');
    }

    static async addCreditCard(cardData) {
        return this.post('/api/credit-cards', cardData);
    }

    static async getCashBalance() {
        return this.get('/api/cash-balance');
    }

    static async setCashBalance(balanceData) {
        return this.post('/api/cash-balance', balanceData);
    }

    // Transaction endpoints
    static async getIncome(month, year) {
        return this.get(`/api/income?month=${month}&year=${year}`);
    }

    static async addIncome(incomeData) {
        return this.post('/api/income', incomeData);
    }

    static async getExpenses(month, year) {
        return this.get(`/api/expenses?month=${month}&year=${year}`);
    }

    static async addExpense(expenseData) {
        return this.post('/api/expenses', expenseData);
    }

    static async getMonthlySummary(month, year) {
        return this.get(`/api/monthly-summary?month=${month}&year=${year}`);
    }

    static async setTrackingOption(option) {
        return this.post('/api/set-tracking-option', { trackingOption: option });
    }
}

// Create both static class reference and instance for compatibility
window.ApiClient = ApiClient;

// Create instance with instance methods for our modular architecture
window.apiClient = {
    get: (endpoint) => ApiClient.get(endpoint),
    post: (endpoint, data) => ApiClient.post(endpoint, data),
    put: (endpoint, data) => ApiClient.put(endpoint, data),
    delete: (endpoint) => ApiClient.delete(endpoint)
};
