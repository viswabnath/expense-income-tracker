/**
 * Activity Manager Module
 * Handles user activity tracking and display
 */

class ActivityManager {
    constructor() {
        this.apiClient = window.apiClient;
        this.activities = [];
        this.filteredActivities = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentFilters = {
            type: '',
            dateFrom: '',
            dateTo: ''
        };
    }

    async onSectionShow() {
        await this.loadActivityData();
    }

    async loadActivityData() {
        try {
            const response = await this.apiClient.get('/api/activity');

            if (response && typeof response === 'object') {
                this.activities = response.activities || [];
                this.filteredActivities = [...this.activities];
            } else if (Array.isArray(response)) {
                this.activities = response;
                this.filteredActivities = [...this.activities];
            } else {
                this.showError('Invalid response format from server');
                return;
            }

            this.renderActivityFeed();
        } catch {
            this.showError('Failed to load activity data. Please try again.');
        }
    }

    renderActivityFeed() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) {
            return;
        }

        if (this.filteredActivities.length === 0) {
            activityList.innerHTML = '<div class="no-activities">No activities found</div>';
            return;
        }

        // Sort activities by date (newest first)
        const sortedActivities = [...this.filteredActivities].sort((a, b) => {
            const dateA = new Date(a.activity_date || a.created_at);
            const dateB = new Date(b.activity_date || b.created_at);
            return dateB - dateA;
        });

        // Pagination
        const totalPages = Math.ceil(sortedActivities.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentActivities = sortedActivities.slice(startIndex, endIndex);

        // Create Etherscan-style activity feed
        let feedHTML = `
            <div class="activity-feed">
                <div class="activity-header">
                    <h3>Activity Feed</h3>
                    <div class="activity-stats">
                        <span class="stat-item">Total: ${sortedActivities.length} activities</span>
                        <span class="stat-item">Page ${this.currentPage} of ${totalPages}</span>
                    </div>
                </div>
                <div class="activity-items">
        `;

        currentActivities.forEach(activity => {
            feedHTML += this.renderEtherscanStyleActivity(activity);
        });

        feedHTML += `
                </div>
                ${this.renderPagination(totalPages)}
            </div>
        `;

        activityList.innerHTML = feedHTML;
        this.attachPaginationEvents();
    }

    renderEtherscanStyleActivity(activity) {
        const date = new Date(activity.activity_date || activity.created_at);
        const formattedDate = date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Handle different activity types with proper amount display
        let actionIcon, actionText, actionClass, amount, description, accountInfo;

        if (activity.activity_type === 'audit') {
            // Handle audit logs properly
            switch (activity.action_type) {
            case 'created':
                if (activity.description.includes('cash balance')) {
                    actionIcon = '💰';
                    actionText = 'Cash Balance Set';
                    actionClass = 'action-cash-add';
                } else if (activity.description.includes('bank')) {
                    actionIcon = '🏦';
                    actionText = 'Bank Added';
                    actionClass = 'action-bank-add';
                } else if (activity.description.includes('income')) {
                    actionIcon = '📈';
                    actionText = 'Income Added';
                    actionClass = 'action-income';
                } else if (activity.description.includes('expense')) {
                    actionIcon = '📉';
                    actionText = 'Expense Added';
                    actionClass = 'action-expense';
                } else {
                    actionIcon = '➕';
                    actionText = 'Created';
                    actionClass = 'action-create';
                }
                break;
            case 'updated':
                actionIcon = '✏️';
                actionText = 'Updated';
                actionClass = 'action-update';
                break;
            case 'deleted':
                actionIcon = '🗑️';
                actionText = 'Deleted';
                actionClass = 'action-delete';
                break;
            default:
                actionIcon = '🔄';
                actionText = 'Modified';
                actionClass = 'action-other';
            }
            amount = activity.amount ? `₹${parseFloat(activity.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '—';
            description = activity.description || 'System operation';
            accountInfo = activity.account_info || 'System';
        } else {
            // Handle legacy activity types
            switch (activity.activity_type) {
            case 'income':
                actionIcon = '📈';
                actionText = 'Income Added';
                actionClass = 'action-income';
                break;
            case 'expense':
                actionIcon = '📉';
                actionText = 'Expense Added';
                actionClass = 'action-expense';
                break;
            case 'setup':
                actionIcon = '⚙️';
                actionText = 'Account Setup';
                actionClass = 'action-setup';
                break;
            default:
                actionIcon = '🔄';
                actionText = 'Transaction';
                actionClass = 'action-other';
            }
            amount = activity.amount ? `₹${parseFloat(activity.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '—';
            description = activity.description || 'Transaction';
            accountInfo = activity.account_info || 'Unknown Account';
        }

        return `
            <div class="activity-item ${actionClass}">
                <div class="activity-main">
                    <div class="activity-icon">
                        <span class="icon">${actionIcon}</span>
                    </div>
                    <div class="activity-content">
                        <div class="activity-header-row">
                            <span class="activity-action">${actionText}</span>
                            <span class="activity-amount">${amount}</span>
                        </div>
                        <div class="activity-description">
                            ${description}
                        </div>
                        <div class="activity-meta">
                            <span class="activity-account">📍 ${accountInfo}</span>
                            <span class="activity-timestamp">🕒 ${formattedDate} at ${formattedTime}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPagination(totalPages) {
        if (totalPages <= 1) return '';

        let paginationHTML = '<div class="pagination">';

        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage - 1}">« Previous</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += '<button class="pagination-btn" data-page="1">1</button>';
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            paginationHTML += `<button class="pagination-btn ${isActive}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            }
            paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage + 1}">Next »</button>`;
        }

        paginationHTML += '</div>';
        return paginationHTML;
    }

    attachPaginationEvents() {
        const paginationBtns = document.querySelectorAll('.pagination-btn');
        paginationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderActivityFeed();
                }
            });
        });
    }

    async filterActivity() {
        const monthFilter = document.getElementById('activity-month')?.value || '';
        const yearFilter = document.getElementById('activity-year')?.value || '';
        const loadBtn = document.querySelector('button[data-action="filterActivity"]');

        try {
            // Add loading state
            if (loadBtn) {
                loadBtn.classList.add('loading');
                loadBtn.querySelector('.btn-icon').textContent = '⏳';
            }

            // Build query parameters for server-side filtering
            const params = new URLSearchParams();
            if (monthFilter) params.append('month', monthFilter);
            if (yearFilter) params.append('year', yearFilter);
            
            const queryString = params.toString();
            const endpoint = queryString ? `/api/activity?${queryString}` : '/api/activity';
            
            const response = await this.apiClient.get(endpoint);

            if (response && typeof response === 'object') {
                this.activities = response.activities || [];
                this.filteredActivities = [...this.activities];
            } else if (Array.isArray(response)) {
                this.activities = response;
                this.filteredActivities = [...this.activities];
            } else {
                this.showError('Invalid response format from server');
                return;
            }

            // Reset to first page when filtering
            this.currentPage = 1;
            this.renderActivityFeed();
        } catch (error) {
            this.showError('Failed to load filtered activity data. Please try again.');
        } finally {
            // Remove loading state
            if (loadBtn) {
                loadBtn.classList.remove('loading');
                loadBtn.querySelector('.btn-icon').textContent = '🔍';
            }
        }
    }

    clearActivityFilters() {
        // Reset filter inputs
        const monthFilter = document.getElementById('activity-month');
        const yearFilter = document.getElementById('activity-year');
        const clearBtn = document.querySelector('button[data-action="clearActivityFilters"]');

        // Add loading state
        if (clearBtn) {
            clearBtn.classList.add('loading');
            clearBtn.querySelector('.btn-icon').textContent = '⏳';
        }

        if (monthFilter) monthFilter.value = '';
        if (yearFilter) yearFilter.value = '';

        // Reset filters and show all activities
        setTimeout(() => {
            this.filteredActivities = [...this.activities];
            this.currentPage = 1; // Reset to first page
            this.renderActivityFeed();
            
            // Remove loading state
            if (clearBtn) {
                clearBtn.classList.remove('loading');
                clearBtn.querySelector('.btn-icon').textContent = '🗑️';
            }
        }, 300); // Small delay for visual feedback
    }

    showLoading() {
        const loadingEl = document.getElementById('activity-loading');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('activity-loading');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }

    showError(message) {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            activityList.innerHTML = `<p class="error-message">${message}</p>`;
        }
    }

    // Refresh activity data (can be called when new transactions are added)
    async refreshData() {
        await this.loadActivityData();
    }
}

// Global activity manager instance
window.activityManager = new ActivityManager();

// Global functions for onclick handlers
/* eslint-disable no-unused-vars */
function filterActivity() {
    window.activityManager.filterActivity();
}

function clearActivityFilters() {
    window.activityManager.clearActivityFilters();
}
/* eslint-enable no-unused-vars */

