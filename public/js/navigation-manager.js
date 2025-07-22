/**
 * Navigation Manager Module
 * Handles section navigation and UI state management
 */

class NavigationManager {
    constructor() {
        this.apiClient = window.apiClient;
    }

    showSection(section) {
        // Hide all sections
        const sections = ['setup-section', 'transactions-section', 'summary-section'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) element.classList.add('hidden');
        });

        // Show the requested section
        const targetSection = document.getElementById(section + '-section');
        if (targetSection) targetSection.classList.remove('hidden');

        // Load section-specific data
        if (section === 'transactions') {
            window.transactionManager.updateTransactionFormVisibility();
            window.transactionManager.loadPaymentOptions();
            window.transactionManager.loadTransactions();
        } else if (section === 'summary') {
            window.summaryManager.loadMonthlySummary();
        }
    }

    async setTrackingOption(option) {
        window.expenseTracker.trackingOption = option;

        try {
            await this.apiClient.post('/api/set-tracking-option', {
                trackingOption: option
            });

            this.hideWelcomeSection();
            this.showMainApp();
            this.showSection('setup');
            window.setupManager.loadSetupData();
        } catch (error) {
            console.error('Error setting tracking option:', error);
        }
    }

    hideWelcomeSection() {
        const welcomeSection = document.getElementById('welcome-section');
        if (welcomeSection) welcomeSection.classList.add('hidden');
    }

    showMainApp() {
        const mainApp = document.getElementById('main-app');
        if (mainApp) mainApp.classList.remove('hidden');
    }
}

// Global navigation manager instance
window.navigationManager = new NavigationManager();
