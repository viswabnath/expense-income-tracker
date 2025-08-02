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
        const sections = ['setup-section', 'transactions-section', 'summary-section', 'activity-section'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) element.classList.add('hidden');
        });

        // Show the requested section
        const targetSection = document.getElementById(section + '-section');
        if (targetSection) targetSection.classList.remove('hidden');

        // Load section-specific data
        if (section === 'setup') {
            window.setupManager.onSectionShow();
        } else if (section === 'transactions') {
            window.transactionManager.updateTransactionFormVisibility();
            window.transactionManager.loadPaymentOptions();
            window.transactionManager.initializeTransactionFilters();
            window.transactionManager.loadTransactions();
        } else if (section === 'summary') {
            window.summaryManager.loadMonthlySummary();
        } else if (section === 'activity') {
            if (window.activityManager) {
                window.activityManager.onSectionShow();
            } else {
                console.error('NavigationManager: activityManager not available!');
            }
        }
    }

    async setTrackingOption(option) {
        window.expenseTracker.trackingOption = option;

        try {
            await this.apiClient.post('/api/set-tracking-option', {
                trackingOption: option
            });

            this.hideWelcomeSection();
            // Show navigation bar explicitly
            const navBar = document.getElementById('nav-bar');
            if (navBar) navBar.style.display = 'flex';
            this.showMainApp();
            this.showSection('setup');
            window.setupManager.onSectionShow();
        } catch (error) {
            // Error handling code can be added here if needed
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

    // Mobile navigation functions
    toggleMobileNav() {
        const dropdown = document.getElementById('nav-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    closeMobileNav() {
        const dropdown = document.getElementById('nav-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    // Sidebar functions
    toggleSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        document.body.classList.add('sidebar-open');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeSidebar() {
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }

    // Close mobile nav when clicking outside
    handleOutsideClick(event) {
        const dropdown = document.getElementById('nav-dropdown');
        const hamburgerButton = document.querySelector('.hamburger-button');

        if (dropdown && hamburgerButton &&
            !dropdown.contains(event.target) &&
            !hamburgerButton.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    }
}

// Global navigation manager instance
window.navigationManager = new NavigationManager();

// Global functions for onclick handlers (exposed for use by event-handlers.js)
/* eslint-disable no-unused-vars */
function showSection(section) {
    window.navigationManager.showSection(section);
}

function toggleSidebar() {
    window.navigationManager.toggleSidebar();
}

function toggleMobileNav() {
    window.navigationManager.toggleMobileNav();
}

function closeMobileNav() {
    window.navigationManager.closeMobileNav();
}

function openSidebar() {
    window.navigationManager.openSidebar();
}

function closeSidebar() {
    window.navigationManager.closeSidebar();
}
/* eslint-enable no-unused-vars */

// Add click outside listener for mobile nav
document.addEventListener('click', (event) => {
    window.navigationManager.handleOutsideClick(event);
});

// Add keyboard listener for ESC key to close sidebar
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        window.navigationManager.closeSidebar();
    }
});
