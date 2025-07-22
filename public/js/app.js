/**
 * Expense Tracker Application
 * Main application logic and state management
 */

class ExpenseTracker {
    constructor() {
        this.currentUser = null;
        this.trackingOption = 'both';
        this.resetUserId = null;
        this.init();
    }

    init() {
        this.setupDateInputs();
        this.setupYearDropdown();
        this.setCurrentMonth();
        this.setupGlobalFunctions();
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
        window.logout = () => window.authManager.logout();
        
        window.setTrackingOption = (option) => window.navigationManager.setTrackingOption(option);
        window.showSection = (section) => window.navigationManager.showSection(section);
        
        window.addBank = () => window.setupManager.addBank();
        window.addCreditCard = () => window.setupManager.addCreditCard();
        window.setCashBalance = () => window.setupManager.setCashBalance();
        
        window.addIncome = () => window.transactionManager.addIncome();
        window.addExpense = () => window.transactionManager.addExpense();
        
        window.loadMonthlySummary = () => window.summaryManager.loadMonthlySummary();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.expenseTracker = new ExpenseTracker();
});
