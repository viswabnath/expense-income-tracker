/**
 * Expense Tracker Application
 * Main application logic and state management
 */

class ExpenseTracker {
    constructor() {
        this.currentUser = null;
        this.trackingOption = 'both';
        this.resetUserId = null;
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        this.setupDateInputs();
        this.setupYearDropdown();
        this.setCurrentMonth();
        this.setupGlobalFunctions();

        // Check authentication status
        await this.checkAuthenticationStatus();
    }

    async checkAuthenticationStatus() {
        try {
            const authStatus = await window.authManager.checkAuthentication();

            if (authStatus.isAuthenticated) {
                this.isAuthenticated = true;
                this.currentUser = authStatus.user;
                this.trackingOption = authStatus.user.tracking_option || 'both';

                // User is authenticated, show the main app
                this.showMainApplication();
            } else {
                this.isAuthenticated = false;
                // User is not authenticated, show login form
                this.showAuthenticationForms();
            }
        } catch (error) {
            this.isAuthenticated = false;
            this.showAuthenticationForms();
        }
    }

    showMainApplication() {
        // Hide authentication forms
        const authForms = document.querySelectorAll('.auth-form');
        authForms.forEach(form => form.classList.add('hidden'));

        // Hide auth section
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            authSection.classList.add('hidden');
        }

        // Show navigation bar
        const navBar = document.getElementById('nav-bar');
        if (navBar) {
            navBar.style.display = 'flex';
        }

        // Check if user has already set tracking option
        if (this.trackingOption && this.trackingOption !== 'none') {
            // User has tracking option set, go directly to main app
            const welcomeSection = document.getElementById('welcome-section');
            if (welcomeSection) {
                welcomeSection.classList.add('hidden');
            }

            const mainApp = document.getElementById('main-app');
            if (mainApp) {
                mainApp.classList.remove('hidden');
                // Set user name in nav
                const userName = document.getElementById('user-name');
                if (userName && this.currentUser) {
                    userName.textContent = this.currentUser.name || this.currentUser.username;
                }
                // Show setup section by default
                window.navigationManager.showSection('setup');
            }
        } else {
            // New user or no tracking option set, show welcome section
            const welcomeSection = document.getElementById('welcome-section');
            if (welcomeSection) {
                welcomeSection.classList.remove('hidden');
                // Set user name in welcome
                const userName = document.getElementById('user-name');
                if (userName && this.currentUser) {
                    userName.textContent = this.currentUser.name || this.currentUser.username;
                }
            }
        }
    }

    showAuthenticationForms() {
        // Hide main app sections
        const welcomeSection = document.getElementById('welcome-section');
        if (welcomeSection) {
            welcomeSection.classList.add('hidden');
        }

        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.classList.add('hidden');
        }

        // Hide navigation
        const navBar = document.getElementById('nav-bar');
        if (navBar) {
            navBar.style.display = 'none';
        }

        // Show auth section
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            authSection.classList.remove('hidden');
        }

        // Show login form
        window.authManager.showLoginForm();
    }

    setupDateInputs() {
        const currentDate = new Date();
        const incomeDate = document.getElementById('income-date');
        const expenseDate = document.getElementById('expense-date');

        if (incomeDate) incomeDate.valueAsDate = currentDate;
        if (expenseDate) expenseDate.valueAsDate = currentDate;
    }

    setupYearDropdown() {
        const yearSelect = document.getElementById('summary-year');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';

        for (let year = currentYear - 5; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }

    setCurrentMonth() {
        const monthSelect = document.getElementById('summary-month');
        if (monthSelect) {
            monthSelect.value = new Date().getMonth() + 1;
        }
    }

    setupGlobalFunctions() {
        // Make functions available globally for HTML onclick handlers
        window.login = () => window.authManager.login();
        window.register = () => window.authManager.register();
        window.showLogin = () => window.authManager.showLoginForm();
        window.showRegister = () => window.authManager.showRegisterForm();
        window.showForgotPassword = () => window.authManager.showForgotPasswordForm();
        window.requestPasswordReset = () => window.authManager.requestPasswordReset();
        window.resetPassword = () => window.authManager.resetPassword();
        window.showForgotUsername = () => window.authManager.showForgotUsernameForm();
        window.forgotUsername = () => window.authManager.forgotUsername();
        window.showEmailReset = () => window.authManager.showEmailResetForm();
        window.requestPasswordResetByEmail = () => window.authManager.requestPasswordResetByEmail();
        window.resetPasswordWithToken = () => window.authManager.resetPasswordWithToken();
        window.logout = () => window.authManager.logout();

        window.setTrackingOption = (option) => window.navigationManager.setTrackingOption(option);
        window.showSection = (section) => window.navigationManager.showSection(section);

        window.addBank = () => window.setupManager.addBank();
        window.addCreditCard = () => window.setupManager.addCreditCard();
        window.setCashBalance = () => window.setupManager.setCashBalance();

        window.addIncome = () => window.transactionManager.addIncome();
        window.addExpense = () => window.transactionManager.addExpense();

        window.loadMonthlySummary = () => window.summaryManager.loadMonthlySummary();

        // Activity Manager functions
        window.filterActivity = () => window.activityManager.filterActivity();
        window.clearActivityFilters = () => window.activityManager.clearActivityFilters();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.expenseTracker = new ExpenseTracker();
});
