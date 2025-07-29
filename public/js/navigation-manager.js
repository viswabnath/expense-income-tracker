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
        if (section === 'setup') {
            window.setupManager.loadSetupData();
        } else if (section === 'transactions') {
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
            // Show navigation bar explicitly
            const navBar = document.getElementById('nav-bar');
            if (navBar) navBar.style.display = 'flex';
            this.showMainApp();
            this.showSection('setup');
            window.setupManager.loadSetupData();
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
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
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

// Global functions for onclick handlers
function showSection(section) {
    window.navigationManager.showSection(section);
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
