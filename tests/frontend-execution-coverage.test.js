/**
 * Frontend JavaScript Execution Coverage Tests
 * Tests that actually execute frontend code for coverage instrumentation
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Helper function to load and execute JavaScript files in the window context
function loadScript(filename) {
    const scriptPath = path.join(__dirname, '../public/js', filename);
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Create a script element and append to document head to properly execute in JSDOM
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);

    return scriptContent;
}

// Set up comprehensive DOM mock
beforeAll(() => {
    // Mock fetch globally
    global.fetch = jest.fn();

    // Mock window.location
    Object.defineProperty(window, 'location', {
        value: {
            reload: jest.fn(),
            href: 'http://localhost:3000',
            pathname: '/'
        },
        writable: true
    });

    // Create comprehensive DOM structure
    document.body.innerHTML = `
        <!-- Auth elements -->
        <div id="auth-message"></div>
        <input id="login-username" value="">
        <input id="login-password" value="">
        <input id="register-username" value="">
        <input id="register-email" value="">
        <input id="register-password" value="">
        <input id="forgot-email" value="">
        <input id="reset-password" value="">
        <input id="confirm-password" value="">
        
        <!-- App elements -->
        <input id="income-date" type="date">
        <input id="expense-date" type="date">
        <select id="summary-year"></select>
        <select id="summary-month"></select>
        
        <!-- Setup elements -->
        <div id="bank-message"></div>
        <div id="credit-card-message"></div>
        <div id="cash-balance-message"></div>
        <input id="bank-name" value="">
        <input id="credit-card-name" value="">
        <input id="credit-limit" value="">
        <input id="cash-balance-amount" value="">
        <div id="banks-list"></div>
        <div id="credit-cards-list"></div>
        <div id="cash-balance-display"></div>
        
        <!-- Transaction elements -->
        <select id="income-credited-to"><option value="cash">Cash</option></select>
        <select id="expense-payment-method"><option value="cash">Cash</option></select>
        <input id="income-source" value="">
        <input id="income-amount" value="">
        <input id="expense-category" value="">
        <input id="expense-amount" value="">
        <div id="income-message"></div>
        <div id="expense-message"></div>
        <div id="transactions-list"></div>
        
        <!-- Summary elements -->
        <div id="summary-display"></div>
        
        <!-- Navigation elements -->
        <div id="setup-section" class="hidden"></div>
        <div id="transactions-section" class="hidden"></div>
        <div id="summary-section" class="hidden"></div>
        <div id="welcome-section"></div>
        <div id="main-app" class="hidden"></div>
        
        <!-- Transaction form elements -->
        <div id="income-form" class="hidden"></div>
        <div id="expense-form" class="hidden"></div>
        <div id="both-forms" class="hidden"></div>
    `;
});

beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset DOM element values
    const inputs = ['login-username', 'login-password', 'register-username', 'register-email', 'register-password'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    // Clear window objects
    delete window.apiClient;
    delete window.authManager;
    delete window.expenseTracker;
    delete window.setupManager;
    delete window.transactionManager;
    delete window.navigationManager;
    delete window.summaryManager;

    // Clear all script tags from previous tests
    const scripts = document.head.querySelectorAll('script');
    scripts.forEach(script => script.remove());
});

describe('Frontend JavaScript Execution Coverage', () => {

    describe('ApiClient Execution Coverage', () => {
        test('should execute ApiClient class methods', async () => {
            loadScript('api.js');

            // Mock successful fetch response
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true, data: 'test' })
            });

            // Test static request method
            const result = await window.ApiClient.request('/test-endpoint');
            expect(result).toEqual({ success: true, data: 'test' });
            expect(fetch).toHaveBeenCalledWith('/test-endpoint', expect.objectContaining({
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            }));

            // Test GET method
            await window.ApiClient.get('/test-get');
            expect(fetch).toHaveBeenCalledWith('/test-get', expect.any(Object));

            // Test POST method
            await window.ApiClient.post('/test-post', { test: 'data' });
            expect(fetch).toHaveBeenCalledWith('/test-post', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ test: 'data' })
            }));
        });

        test('should handle ApiClient error responses', async () => {
            loadScript('api.js');

            // Mock error response
            fetch.mockResolvedValue({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ error: 'Not found' })
            });

            await expect(window.ApiClient.request('/error-endpoint')).rejects.toThrow('Not found');
        });

        test('should handle ApiClient network errors', async () => {
            loadScript('api.js');

            // Mock network error
            fetch.mockRejectedValue(new Error('Network error'));

            await expect(window.ApiClient.request('/network-error')).rejects.toThrow('Network error');
        });
    });

    describe('AuthManager Execution Coverage', () => {
        test('should execute AuthManager validation methods', () => {
            loadScript('auth.js');

            // Test email validation
            expect(window.AuthManager.validateEmail('test@example.com')).toBe(true);
            expect(window.AuthManager.validateEmail('invalid-email')).toBe(false);

            // Test username validation
            expect(window.AuthManager.validateUsername('validuser123')).toBe(true);
            expect(window.AuthManager.validateUsername('invalid@user')).toBe(false);

            // Test password validation
            expect(window.AuthManager.validatePassword('ValidPass123&')).toBeNull();
            expect(window.AuthManager.validatePassword('weak')).toContain('must be between 8 and 16 characters');
            expect(window.AuthManager.validatePassword('nouppercase123&')).toContain('uppercase letter');
            expect(window.AuthManager.validatePassword('NOLOWERCASE123&')).toContain('lowercase letter');
            expect(window.AuthManager.validatePassword('NoNumber_&')).toContain('number');
            expect(window.AuthManager.validatePassword('NoSpecialChar123')).toContain('special character');
        });

        test('should execute AuthManager input validation', () => {
            loadScript('auth.js');

            // Test validateInput method
            expect(() => window.AuthManager.validateInput('', 'Username')).toThrow('Username is required');
            expect(() => window.AuthManager.validateInput('   ', 'Password')).toThrow('Password is required');
            expect(() => window.AuthManager.validateInput('valid', 'Field')).not.toThrow();
        });

        test('should execute AuthManager instance creation and login', async () => {
            loadScript('auth.js');

            // Mock successful login
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true, user: { id: 1, username: 'testuser' } })
            });

            const authManager = new window.AuthManager();
            expect(authManager.resetUserId).toBeNull();

            // Set up DOM values
            document.getElementById('login-username').value = 'testuser';
            document.getElementById('login-password').value = 'testpass123&';

            await authManager.login();

            expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ username: 'testuser', password: 'testpass123&' })
            }));
        });
    });

    describe('ExpenseTracker (app.js) Execution Coverage', () => {
        test('should execute ExpenseTracker initialization', () => {
            loadScript('app.js');

            const tracker = new window.ExpenseTracker();

            // Verify initialization
            expect(tracker.currentUser).toBeNull();
            expect(tracker.trackingOption).toBe('both');
            expect(tracker.resetUserId).toBeNull();

            // Verify date inputs are set
            const incomeDate = document.getElementById('income-date');
            const expenseDate = document.getElementById('expense-date');
            expect(incomeDate.valueAsDate).toBeInstanceOf(Date);
            expect(expenseDate.valueAsDate).toBeInstanceOf(Date);
        });

        test('should execute ExpenseTracker year dropdown setup', () => {
            loadScript('app.js');

            const tracker = new window.ExpenseTracker();

            const yearSelect = document.getElementById('summary-year');
            expect(yearSelect.children.length).toBeGreaterThan(0);

            // Verify current year is selected
            const currentYear = new Date().getFullYear();
            const selectedOption = Array.from(yearSelect.options).find(option => option.selected);
            expect(parseInt(selectedOption.value)).toBe(currentYear);
        });

        test('should execute ExpenseTracker global functions setup', () => {
            loadScript('app.js');

            new window.ExpenseTracker();

            // Verify global functions are created
            expect(typeof window.login).toBe('function');
            expect(typeof window.register).toBe('function');
            expect(typeof window.setTrackingOption).toBe('function');
            expect(typeof window.showSection).toBe('function');
        });
    });

    describe('NavigationManager Execution Coverage', () => {
        test('should execute NavigationManager section management', () => {
            // Set up required objects first
            window.apiClient = { post: jest.fn() };
            window.expenseTracker = { trackingOption: 'both' };
            window.transactionManager = {
                updateTransactionFormVisibility: jest.fn(),
                loadPaymentOptions: jest.fn(),
                loadTransactions: jest.fn()
            };
            window.summaryManager = { loadMonthlySummary: jest.fn() };
            window.setupManager = { loadSetupData: jest.fn() };

            loadScript('navigation-manager.js');

            const navManager = new window.NavigationManager();

            // Test showSection method
            navManager.showSection('transactions');

            // Verify sections are hidden/shown correctly
            expect(document.getElementById('setup-section').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('summary-section').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('transactions-section').classList.contains('hidden')).toBe(false);

            // Verify transaction-specific methods are called
            expect(window.transactionManager.updateTransactionFormVisibility).toHaveBeenCalled();
            expect(window.transactionManager.loadPaymentOptions).toHaveBeenCalled();
            expect(window.transactionManager.loadTransactions).toHaveBeenCalled();
        });

        test('should execute NavigationManager tracking option setting', async () => {
            window.apiClient = {
                post: jest.fn().mockResolvedValue({ success: true })
            };
            window.expenseTracker = { trackingOption: 'both' };
            window.setupManager = { loadSetupData: jest.fn() };

            loadScript('navigation-manager.js');

            const navManager = new window.NavigationManager();

            await navManager.setTrackingOption('expenses');

            expect(window.expenseTracker.trackingOption).toBe('expenses');
            expect(window.apiClient.post).toHaveBeenCalledWith('/api/set-tracking-option', {
                trackingOption: 'expenses'
            });
        });
    });

    describe('SetupManager Execution Coverage', () => {
        test('should execute SetupManager message methods', () => {
            window.apiClient = { get: jest.fn(), post: jest.fn() };

            loadScript('setup-manager.js');

            const setupManager = new window.SetupManager();

            // Test showError method
            setupManager.showError('bank-message', 'Test error message');
            const errorElement = document.getElementById('bank-message');
            expect(errorElement.textContent).toBe('Test error message');
            expect(errorElement.className).toBe('error');
            expect(errorElement.style.display).toBe('block');

            // Test showSuccess method
            setupManager.showSuccess('bank-message', 'Test success message');
            expect(errorElement.textContent).toBe('Test success message');
            expect(errorElement.className).toBe('success');

            // Test clearMessage method
            setupManager.clearMessage('bank-message');
            expect(errorElement.textContent).toBe('');
            expect(errorElement.style.display).toBe('none');
        });

        test('should execute SetupManager load data methods', async () => {
            window.apiClient = {
                get: jest.fn()
                    .mockResolvedValueOnce([{ id: 1, name: 'Bank 1' }])
                    .mockResolvedValueOnce([{ id: 1, name: 'Card 1' }])
                    .mockResolvedValueOnce({ balance: 1000 })
            };

            loadScript('setup-manager.js');

            const setupManager = new window.SetupManager();

            await setupManager.loadSetupData();

            expect(window.apiClient.get).toHaveBeenCalledWith('/api/banks');
            expect(window.apiClient.get).toHaveBeenCalledWith('/api/credit-cards');
            expect(window.apiClient.get).toHaveBeenCalledWith('/api/cash-balance');
        });
    });

    describe('TransactionManager Execution Coverage', () => {
        test('should execute TransactionManager payment options loading', async () => {
            window.apiClient = {
                get: jest.fn()
                    .mockResolvedValueOnce([{ id: 1, name: 'Bank 1' }])
                    .mockResolvedValueOnce([{ id: 1, name: 'Credit Card 1' }])
            };

            loadScript('transaction-manager.js');

            const transManager = new window.TransactionManager();

            await transManager.loadPaymentOptions();

            expect(window.apiClient.get).toHaveBeenCalledWith('/api/banks');
            expect(window.apiClient.get).toHaveBeenCalledWith('/api/credit-cards');

            // Verify options are added to selects
            const incomeSelect = document.getElementById('income-credited-to');
            const expenseSelect = document.getElementById('expense-payment-method');
            expect(incomeSelect.children.length).toBeGreaterThan(1);
            expect(expenseSelect.children.length).toBeGreaterThan(1);
        });

        test('should execute TransactionManager form visibility update', () => {
            window.expenseTracker = { trackingOption: 'both' };

            loadScript('transaction-manager.js');

            const transManager = new window.TransactionManager();

            transManager.updateTransactionFormVisibility();

            // Verify form visibility based on tracking option
            expect(document.getElementById('both-forms').classList.contains('hidden')).toBe(false);
        });
    });

    describe('SummaryManager Execution Coverage', () => {
        test('should execute SummaryManager monthly summary loading', async () => {
            window.apiClient = {
                get: jest.fn().mockResolvedValue({
                    income: [{ source: 'Salary', amount: 5000 }],
                    expenses: [{ category: 'Food', amount: 500 }],
                    totalIncome: 5000,
                    totalExpenses: 500,
                    netSavings: 4500
                })
            };

            loadScript('summary-manager.js');

            // Set month and year
            document.getElementById('summary-month').value = '12';
            document.getElementById('summary-year').value = '2024';

            const summaryManager = new window.SummaryManager();

            await summaryManager.loadMonthlySummary();

            expect(window.apiClient.get).toHaveBeenCalledWith('/api/monthly-summary?month=12&year=2024');

            // Verify summary display is updated
            const summaryDisplay = document.getElementById('summary-display');
            expect(summaryDisplay.innerHTML).not.toBe('');
        });

        test('should handle SummaryManager error states', async () => {
            window.apiClient = {
                get: jest.fn().mockRejectedValue(new Error('Authentication required'))
            };

            loadScript('summary-manager.js');

            document.getElementById('summary-month').value = '12';
            document.getElementById('summary-year').value = '2024';

            const summaryManager = new window.SummaryManager();

            await summaryManager.loadMonthlySummary();

            const summaryDisplay = document.getElementById('summary-display');
            expect(summaryDisplay.innerHTML).toContain('Please log in');
        });
    });

    describe('Debug and Module Validator Execution Coverage', () => {
        test('should execute debug script functions', () => {
            loadScript('debug.js');

            // Verify console.log was called (debug script logs information)
            expect(console.log).toHaveBeenCalled();
        });

        test('should execute module validator functions', () => {
            loadScript('module-validator.js');

            // Test validateModules function
            expect(typeof window.validateModules).toBe('function');
            expect(typeof window.checkForDuplicates).toBe('function');

            const result = window.validateModules();
            expect(typeof result).toBe('boolean');
        });
    });
});
const result = window.validateModules();
expect(typeof result).toBe('boolean');
