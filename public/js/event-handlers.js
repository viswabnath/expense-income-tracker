/**
 * Event Handlers Module
 * Replaces inline onclick handlers with proper event listeners for CSP compatibility
 */

/* global login, register, showRegister, showLogin, showForgotUsername, showForgotPassword, forgotUsername, requestPasswordReset, resetPassword, logout, showSection, toggleSidebar, closeSidebar, setTrackingOption */

class EventHandlers {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Wait a bit more for all scripts to load
                setTimeout(() => this.bindEvents(), 100);
            });
        } else {
            // DOM is already ready, wait a bit for scripts to load
            setTimeout(() => this.bindEvents(), 100);
        }
    }

    bindEvents() {
        // Authentication form events
        this.bindAuthEvents();

        // Navigation events
        this.bindNavigationEvents();

        // Tracking option events
        this.bindTrackingEvents();

        // Setup section events
        this.bindSetupEvents();

        // Transaction events
        this.bindTransactionEvents();

        // Summary events
        this.bindSummaryEvents();
    }

    bindAuthEvents() {
        // Login button
        const loginBtn = document.querySelector('button[data-action="login"]');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => login());
        }

        // Register button
        const registerBtn = document.querySelector('button[data-action="register"]');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => register());
        }

        // Show register button
        const showRegisterBtn = document.querySelector('button[data-action="showRegister"]');
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', () => showRegister());
        }

        // Show login buttons
        const showLoginBtns = document.querySelectorAll('button[data-action="showLogin"]');
        showLoginBtns.forEach(btn => {
            btn.addEventListener('click', () => showLogin());
        });

        // Forgot username button
        const forgotUsernameBtn = document.querySelector('button[data-action="showForgotUsername"]');
        if (forgotUsernameBtn) {
            forgotUsernameBtn.addEventListener('click', () => showForgotUsername());
        }

        // Forgot password button
        const forgotPasswordBtn = document.querySelector('button[data-action="showForgotPassword"]');
        if (forgotPasswordBtn) {
            forgotPasswordBtn.addEventListener('click', () => showForgotPassword());
        }

        // Find username button
        const findUsernameBtn = document.querySelector('button[data-action="forgotUsername"]');
        if (findUsernameBtn) {
            findUsernameBtn.addEventListener('click', () => forgotUsername());
        }

        // Request password reset button
        const requestResetBtn = document.querySelector('button[data-action="requestPasswordReset"]');
        if (requestResetBtn) {
            requestResetBtn.addEventListener('click', () => requestPasswordReset());
        }

        // Reset password button
        const resetPasswordBtn = document.querySelector('button[data-action="resetPassword"]');
        if (resetPasswordBtn) {
            resetPasswordBtn.addEventListener('click', () => resetPassword());
        }

        // Logout buttons
        const logoutBtns = document.querySelectorAll('[data-action="logout"]');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
                if (btn.dataset.closeSidebar) {
                    closeSidebar();
                }
            });
        });
    }

    bindNavigationEvents() {
        // Hamburger menu
        const hamburgerBtn = document.querySelector('button[data-action="toggleSidebar"]');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => toggleSidebar());
        }

        // Sidebar overlay
        const sidebarOverlay = document.querySelector('#sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => closeSidebar());
        }

        // Navigation links
        const navLinks = document.querySelectorAll('[data-action="showSection"]');
        navLinks.forEach(link => {
            const section = link.dataset.section;
            if (section) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    showSection(section);
                    if (link.dataset.closeSidebar) {
                        closeSidebar();
                    }
                    return false;
                });
            }
        });
    }

    bindTrackingEvents() {
        // Tracking option buttons
        const trackingBtns = document.querySelectorAll('button[data-action="setTrackingOption"]');
        trackingBtns.forEach(btn => {
            const option = btn.dataset.option;
            if (option) {
                btn.addEventListener('click', () => setTrackingOption(option));
            }
        });
    }

    bindSetupEvents() {
        // Bank add button
        const addBankBtn = document.querySelector('button[data-action="addBank"]');
        if (addBankBtn) {
            addBankBtn.addEventListener('click', () => {
                if (window.setupManager) {
                    window.setupManager.addBank();
                }
            });
        }

        // Credit card add button
        const addCreditCardBtn = document.querySelector('button[data-action="addCreditCard"]');
        if (addCreditCardBtn) {
            addCreditCardBtn.addEventListener('click', () => {
                if (window.setupManager) {
                    window.setupManager.addCreditCard();
                }
            });
        }

        // Cash balance set button
        const setCashBalanceBtn = document.querySelector('button[data-action="setCashBalance"]');
        if (setCashBalanceBtn) {
            setCashBalanceBtn.addEventListener('click', () => {
                if (window.setupManager) {
                    window.setupManager.setCashBalance();
                }
            });
        }

        // Bank form submission (if forms exist)
        const bankForm = document.querySelector('#bank-form');
        if (bankForm) {
            bankForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (window.setupManager) {
                    window.setupManager.addBank();
                }
            });
        }

        // Credit card form submission
        const creditCardForm = document.querySelector('#credit-card-form');
        if (creditCardForm) {
            creditCardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (window.setupManager) {
                    window.setupManager.addCreditCard();
                }
            });
        }

        // Cash balance form submission
        const cashForm = document.querySelector('#cash-form');
        if (cashForm) {
            cashForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (window.setupManager) {
                    window.setupManager.setCashBalance();
                }
            });
        }
    }

    bindTransactionEvents() {
        // Add income button
        const addIncomeBtn = document.querySelector('button[data-action="addIncome"]');
        if (addIncomeBtn) {
            addIncomeBtn.addEventListener('click', () => {
                if (window.transactionManager) {
                    window.transactionManager.addIncome();
                }
            });
        }

        // Add expense button
        const addExpenseBtn = document.querySelector('button[data-action="addExpense"]');
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => {
                if (window.transactionManager) {
                    window.transactionManager.addExpense();
                }
            });
        }

        // Income form submission
        const incomeForm = document.querySelector('#income-form');
        if (incomeForm) {
            incomeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (window.transactionManager) {
                    window.transactionManager.addIncome();
                }
            });
        }

        // Expense form submission
        const expenseForm = document.querySelector('#expense-form');
        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (window.transactionManager) {
                    window.transactionManager.addExpense();
                }
            });
        }

        // Month navigation
        const prevMonthBtn = document.querySelector('#prev-month');
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                if (window.transactionManager) {
                    window.transactionManager.changeMonth(-1);
                }
            });
        }

        const nextMonthBtn = document.querySelector('#next-month');
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                if (window.transactionManager) {
                    window.transactionManager.changeMonth(1);
                }
            });
        }
    }

    bindSummaryEvents() {
        // Load summary button
        const loadSummaryBtn = document.querySelector('button[data-action="loadMonthlySummary"]');
        if (loadSummaryBtn) {
            loadSummaryBtn.addEventListener('click', () => {
                if (window.summaryManager) {
                    window.summaryManager.loadMonthlySummary();
                }
            });
        }

        // Summary month navigation
        const summaryPrevBtn = document.querySelector('#summary-prev-month');
        if (summaryPrevBtn) {
            summaryPrevBtn.addEventListener('click', () => {
                if (window.summaryManager) {
                    window.summaryManager.changeMonth(-1);
                }
            });
        }

        const summaryNextBtn = document.querySelector('#summary-next-month');
        if (summaryNextBtn) {
            summaryNextBtn.addEventListener('click', () => {
                if (window.summaryManager) {
                    window.summaryManager.changeMonth(1);
                }
            });
        }

        // Generate summary button
        const generateSummaryBtn = document.querySelector('#generate-summary');
        if (generateSummaryBtn) {
            generateSummaryBtn.addEventListener('click', () => {
                if (window.summaryManager) {
                    window.summaryManager.loadSummary();
                }
            });
        }
    }

    // Utility method to rebind events after dynamic content changes
    rebindEvents() {
        this.bindEvents();
    }
}

// Initialize event handlers when the script loads
const eventHandlers = new EventHandlers();

// Make it available globally for rebinding after dynamic content updates
window.eventHandlers = eventHandlers;
