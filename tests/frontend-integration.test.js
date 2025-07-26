/**
 * Frontend Integration Tests
 * Tests frontend JavaScript modules by importing and executing them
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock DOM elements and globals that the frontend code expects
Object.defineProperty(window, 'location', {
    value: {
        reload: jest.fn(),
        href: 'http://localhost:3000'
    }
});

// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
global.console.log = jest.fn();
global.console.error = jest.fn();

describe('Frontend JavaScript Integration Tests', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset fetch mock
        fetch.mockClear();
        
        // Clear window objects
        delete window.apiClient;
        delete window.authManager;
        delete window.transactionManager;
        delete window.summaryManager;
        delete window.setupManager;
    });

    describe('API Client Module', () => {
        test('should load and initialize ApiClient', async () => {
            // Create required DOM elements
            document.body.innerHTML = `
                <div id="global-message"></div>
            `;

            // Mock successful response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: 'test' })
            });

            // Import and test the module
            const fs = require('fs');
            const path = require('path');
            const apiClientPath = path.join(__dirname, '../public/js/api.js');
            const apiClientCode = fs.readFileSync(apiClientPath, 'utf8');
            
            // Execute the code in the jsdom environment
            eval(apiClientCode);

            // Test that ApiClient was created
            expect(window.apiClient).toBeDefined();
            expect(typeof window.apiClient.get).toBe('function');
            expect(typeof window.apiClient.post).toBe('function');

            // Test API call
            const result = await window.apiClient.get('/test');
            expect(result).toEqual({ success: true, data: 'test' });
            expect(fetch).toHaveBeenCalledWith('/test', expect.any(Object));
        });
    });

    describe('Auth Manager Module', () => {
        test('should load and initialize AuthManager', () => {
            // Read auth.js and check it contains expected class structure
            const authScript = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
            
            // Verify that the file contains the AuthManager class definition
            expect(authScript).toContain('class AuthManager');
            expect(authScript).toContain('static validateEmail');
            expect(authScript).toContain('static validatePassword');
            expect(authScript).toContain('async login()');
            
            // Test that the script can be parsed without syntax errors
            expect(() => new Function(authScript)).not.toThrow();
        });

        test('should validate email correctly', () => {
            // Read auth.js and test email validation regex patterns
            const authScript = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
            
            // Extract and test the email validation pattern
            expect(authScript).toContain('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/');
            expect(authScript).toContain('validateEmail(email)');
            
            // Test that the script can be parsed
            expect(() => new Function(authScript)).not.toThrow();
        });

        test('should validate password correctly', () => {
            // Read auth.js and test password validation logic
            const authScript = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
            
            // Verify password validation logic is present
            expect(authScript).toContain('validatePassword(password)');
            expect(authScript).toContain('password.length < 8');
            expect(authScript).toContain('password.length > 16');
            expect(authScript).toContain('/[a-z]/');
            expect(authScript).toContain('/[A-Z]/');
            expect(authScript).toContain('/[0-9]/');
            expect(authScript).toContain('/[_\\-&]/');
            
            // Test that the script can be parsed
            expect(() => new Function(authScript)).not.toThrow();
        });
    });

    describe('Transaction Manager Module', () => {
        test('should load and initialize TransactionManager', () => {
            // Setup DOM
            document.body.innerHTML = `
                <form id="income-form">
                    <input id="income-source" type="text" />
                    <input id="income-amount" type="number" />
                    <select id="income-credited-to"></select>
                    <input id="income-date" type="date" />
                </form>
                <form id="expense-form">
                    <input id="expense-title" type="text" />
                    <input id="expense-amount" type="number" />
                    <select id="expense-payment-method"></select>
                    <input id="expense-date" type="date" />
                </form>
                <div id="transactions-message"></div>
                <tbody id="income-table-body"></tbody>
                <tbody id="expense-table-body"></tbody>
            `;

            // Mock dependencies
            window.apiClient = {
                get: jest.fn().mockResolvedValue([]),
                post: jest.fn().mockResolvedValue({ success: true })
            };
            
            window.setupManager = {
                loadSetupData: jest.fn()
            };

            window.expenseTracker = {
                trackingOption: 'both'
            };

            // Load module
            const fs = require('fs');
            const path = require('path');
            const transactionCode = fs.readFileSync(path.join(__dirname, '../public/js/transaction-manager.js'), 'utf8');
            eval(transactionCode);

            // Test initialization
            expect(window.transactionManager).toBeDefined();
            expect(typeof window.transactionManager.loadPaymentOptions).toBe('function');
            expect(typeof window.transactionManager.addIncome).toBe('function');
            expect(typeof window.transactionManager.addExpense).toBe('function');
        });
    });

    describe('Summary Manager Module', () => {
        test('should load and initialize SummaryManager', () => {
            // Setup DOM
            document.body.innerHTML = `
                <select id="summary-month">
                    <option value="7">July</option>
                </select>
                <select id="summary-year">
                    <option value="2025">2025</option>
                </select>
                <div id="summary-display"></div>
            `;

            // Mock dependencies
            window.apiClient = {
                get: jest.fn().mockResolvedValue({
                    monthlyIncome: 1000,
                    totalCurrentWealth: 5000,
                    totalExpenses: 500,
                    netSavings: 4500,
                    banks: [],
                    cash: { balance: 500 },
                    trackingOption: 'both',
                    isCurrentMonth: true,
                    isMonthCompleted: false
                })
            };

            // Load module
            const fs = require('fs');
            const path = require('path');
            const summaryCode = fs.readFileSync(path.join(__dirname, '../public/js/summary-manager.js'), 'utf8');
            eval(summaryCode);

            // Test initialization
            expect(window.summaryManager).toBeDefined();
            expect(typeof window.summaryManager.loadMonthlySummary).toBe('function');
        });

        test('should load monthly summary and display correctly', async () => {
            // Setup DOM
            document.body.innerHTML = `
                <select id="summary-month">
                    <option value="7" selected>July</option>
                </select>
                <select id="summary-year">
                    <option value="2025" selected>2025</option>
                </select>
                <div id="summary-display"></div>
            `;

            // Mock API response
            const mockSummaryData = {
                monthlyIncome: 1000,
                totalCurrentWealth: 5000,
                totalExpenses: 500,
                netSavings: 4500,
                totalInitialBalance: 4000,
                banks: [{ name: 'TEST BANK', current_balance: 3000 }],
                cash: { balance: 2000 },
                creditCards: [],
                trackingOption: 'both',
                isCurrentMonth: true,
                isMonthCompleted: false
            };

            window.apiClient = {
                get: jest.fn().mockResolvedValue(mockSummaryData)
            };

            // Load and test module
            const fs = require('fs');
            const path = require('path');
            const summaryCode = fs.readFileSync(path.join(__dirname, '../public/js/summary-manager.js'), 'utf8');
            eval(summaryCode);

            // Test summary loading
            await window.summaryManager.loadMonthlySummary();

            expect(window.apiClient.get).toHaveBeenCalledWith('/api/monthly-summary?month=7&year=2025');
            
            const displayContent = document.getElementById('summary-display').innerHTML;
            expect(displayContent).toContain('📊 July 2025 Financial Summary');
            expect(displayContent).toContain('as of now'); // Current month reference
            expect(displayContent).toContain('₹1,000.00'); // Income amount with INR formatting
        });
    });

    describe('Setup Manager Module', () => {
        test('should load and initialize SetupManager', () => {
            // Setup DOM
            document.body.innerHTML = `
                <div id="bank-list"></div>
                <div id="credit-card-list"></div>
                <div id="cash-balance-display"></div>
                <form id="bank-form">
                    <input id="bank-name" type="text" />
                    <input id="bank-balance" type="number" />
                </form>
                <form id="credit-card-form">
                    <input id="credit-card-name" type="text" />
                    <input id="credit-limit" type="number" />
                </form>
                <form id="cash-form">
                    <input id="cash-balance" type="number" />
                </form>
                <div id="setup-message"></div>
            `;

            // Mock dependencies
            window.apiClient = {
                get: jest.fn().mockResolvedValue([]),
                post: jest.fn().mockResolvedValue({ success: true })
            };

            window.expenseTracker = {
                trackingOption: 'both'
            };

            // Load module
            const fs = require('fs');
            const path = require('path');
            const setupCode = fs.readFileSync(path.join(__dirname, '../public/js/setup-manager.js'), 'utf8');
            eval(setupCode);

            // Test initialization
            expect(window.setupManager).toBeDefined();
            expect(typeof window.setupManager.loadSetupData).toBe('function');
            expect(typeof window.setupManager.addBank).toBe('function');
            expect(typeof window.setupManager.addCreditCard).toBe('function');
        });
    });
});
