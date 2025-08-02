/**
 * Toast Notification System
 * Provides non-intrusive success/error/info/warning notifications
 */

class ToastManager {
    constructor() {
        this.toastContainer = null;
        this.toastCounter = 0;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.createToastContainer();
        }
        this.toastContainer = document.getElementById('toast-container');
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duration in milliseconds (default: 4000)
     */
    show(message, type = 'info', duration = 4000) {
        const toastId = `toast-${++this.toastCounter}`;
        const toast = this.createToast(toastId, message, type);

        this.toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);

        // Auto-dismiss
        const dismissTimeout = setTimeout(() => {
            this.dismiss(toastId);
        }, duration);

        // Store timeout for manual dismissal
        toast.dataset.timeoutId = dismissTimeout;

        return toastId;
    }

    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;

        const icon = this.getIcon(type);

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" data-toast-id="${id}">
                    <span>&times;</span>
                </button>
            </div>
        `;

        // Add event listener for close button (CSP-compliant)
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', () => {
            this.dismiss(id);
        });

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || icons.info;
    }

    dismiss(toastId) {
        const toast = document.getElementById(toastId);
        if (!toast) return;

        // Clear timeout if exists
        if (toast.dataset.timeoutId) {
            clearTimeout(parseInt(toast.dataset.timeoutId));
        }

        // Fade out animation
        toast.classList.add('toast-hide');

        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Convenience methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    // Clear all toasts
    clearAll() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => {
            this.dismiss(toast.id);
        });
    }
}

// Initialize global toast manager
window.toastManager = new ToastManager();

// Global convenience functions
window.showToast = (message, type, duration) => window.toastManager.show(message, type, duration);
window.showSuccess = (message, duration) => window.toastManager.success(message, duration);
window.showError = (message, duration) => window.toastManager.error(message, duration);
window.showInfo = (message, duration) => window.toastManager.info(message, duration);
window.showWarning = (message, duration) => window.toastManager.warning(message, duration);
