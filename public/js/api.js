/**
 * API Client
 * Handles all API communications
 */

class ApiClient {
    static async request(endpoint, options = {}) {
        try {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include' // This ensures cookies are sent for authentication
            };

            const response = await fetch(endpoint, { ...defaultOptions, ...options });

            if (!response.ok) {
                // Try to get error message from response body
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch {
                    // If we can't parse the error response, use the default message
                }
                throw new Error(errorMessage);
            }

            return response.json();

        } catch (error) {
            // If it's already an Error object, re-throw it
            if (error instanceof Error) {
                throw error;
            }
            // If it's something else (like network error), wrap it
            throw new Error(`Request failed: ${error.message || error}`);
        }
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

    static async forgotUsername(data) {
        return this.post('/api/forgot-username', data);
    }

    static async forgotPassword(data) {
        return this.post('/api/forgot-password', data);
    }

    static async resetPassword(data) {
        return this.post('/api/reset-password', data);
    }

    static async requestPasswordResetEmail(data) {
        return this.post('/api/request-password-reset-email', data);
    }

    static async resetPasswordWithToken(data) {
        return this.post('/api/reset-password-with-token', data);
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
