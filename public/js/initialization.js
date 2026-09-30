/**
 * Initialization Module
 * Handles DOM initialization tasks that need to run when the page loads
 */

class InitializationManager {
    constructor() {
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeComponents();
            });
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        this.initializeDateDropdowns();
        this.initializeFieldHelp();
    }

    initializeDateDropdowns() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Set current month as selected
        const monthSelect = document.getElementById('summary-month');
        if (monthSelect) {
            monthSelect.value = currentMonth;
        }

        // Populate year dropdown (from 2020 to current year + 1)
        const yearSelect = document.getElementById('summary-year');
        if (yearSelect) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) {
                    option.selected = true;
                }
                yearSelect.appendChild(option);
            }
        }
    }

    initializeFieldHelp() {
        // Map input IDs to their corresponding help element IDs
        const fieldHelpMap = {
            'login-username': 'login-username-help',
            'register-username': 'register-username-help',
            'register-password': 'register-password-help',
            'forgot-username-email': 'forgot-username-email-help',
            'reset-new-password': 'reset-new-password-help'
        };

        // Add event listeners for each field
        Object.keys(fieldHelpMap).forEach(inputId => {
            const inputElement = document.getElementById(inputId);
            const helpElement = document.getElementById(fieldHelpMap[inputId]);

            if (inputElement && helpElement) {
                // Show help on focus
                inputElement.addEventListener('focus', () => {
                    helpElement.classList.remove('hidden');
                });

                // Hide help on blur (when clicking outside)
                inputElement.addEventListener('blur', () => {
                    helpElement.classList.add('hidden');
                });
            }
        });
    }
}

// Initialize when script loads
window.initializationManager = new InitializationManager();
