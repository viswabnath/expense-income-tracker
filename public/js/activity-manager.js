/**
 * Activity Manager Module
 * Handles user activity tracking and display
 */

class ActivityManager {
    constructor() {
        this.apiClient = window.apiClient;
        this.activities = [];
        this.filteredActivities = [];
        this.currentFilters = {
            type: '',
            dateFrom: '',
            dateTo: ''
        };
        this.statistics = {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            totalTransactions: 0
        };
    }

    async onSectionShow() {
        await this.loadActivityData();
        // Note: renderActivityStatistics and renderActivityFeed are already called in loadActivityData
    }

    async loadActivityData() {
        try {
            const response = await this.apiClient.get('/api/activity');

            if (response && typeof response === 'object') {
                if (response.statistics) {
                    this.statistics = response.statistics;
                } else {
                    this.calculateStatistics();
                }

                this.activities = response.activities || [];
                this.filteredActivities = [...this.activities];
            } else if (Array.isArray(response)) {
                this.activities = response;
                this.filteredActivities = [...this.activities];
                this.calculateStatistics();
            } else {
                this.showError('Invalid response format from server');
                return;
            }

            this.renderActivityStatistics();
            this.renderActivityFeed();
        } catch (error) {
            this.showError('Failed to load activity data. Please try again.');
        }
    }

    calculateStatistics() {
        this.statistics = {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            totalTransactions: 0
        };

        this.filteredActivities.forEach(activity => {
            if (activity.activity_type === 'income' && activity.amount) {
                this.statistics.totalIncome += parseFloat(activity.amount);
                this.statistics.totalTransactions++;
            } else if (activity.activity_type === 'expense' && activity.amount) {
                this.statistics.totalExpenses += parseFloat(activity.amount);
                this.statistics.totalTransactions++;
            } else if (activity.activity_type === 'setup') {
                // Count setup activities but don't add to income/expense
                this.statistics.totalTransactions++;
            }
        });

        this.statistics.netBalance = this.statistics.totalIncome - this.statistics.totalExpenses;
    }

    resetStatistics() {
        this.statistics = {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            totalTransactions: 0
        };
    }

    renderActivityStatistics() {
        // Safety check - ensure statistics are properly initialized
        if (!this.statistics || typeof this.statistics !== 'object') {
            this.resetStatistics();
        }

        const totalIncomeEl = document.getElementById('total-income');
        const totalExpensesEl = document.getElementById('total-expenses');
        const netBalanceEl = document.getElementById('net-balance');
        const totalTransactionsEl = document.getElementById('total-transactions');

        if (totalIncomeEl) {
            totalIncomeEl.textContent = `₹${(this.statistics.totalIncome || 0).toFixed(2)}`;
        }
        if (totalExpensesEl) {
            totalExpensesEl.textContent = `₹${(this.statistics.totalExpenses || 0).toFixed(2)}`;
        }
        if (netBalanceEl) {
            const netBalance = this.statistics.netBalance || 0;
            netBalanceEl.textContent = `₹${netBalance.toFixed(2)}`;
            netBalanceEl.className = netBalance >= 0 ? 'stat-value positive' : 'stat-value negative';
        }
        if (totalTransactionsEl) {
            totalTransactionsEl.textContent = (this.statistics.totalTransactions || 0).toString();
        }
    }

    renderActivityFeed() {

        const activityList = document.getElementById('activity-list');
        if (!activityList) {
            return;
        }

        if (this.filteredActivities.length === 0) {
            activityList.innerHTML = '<p class="no-data">No activities found. Start by adding some transactions!</p>';
            return;
        }

        // Sort activities by date (newest first)
        const sortedActivities = [...this.filteredActivities].sort((a, b) => {
            const dateA = new Date(a.activity_date || a.created_at);
            const dateB = new Date(b.activity_date || b.created_at);
            return dateB - dateA;
        });

        const activityHTML = sortedActivities.map(activity => this.renderActivityItem(activity)).join('');
        activityList.innerHTML = activityHTML;
    }

    renderActivityItem(activity) {
        const date = new Date(activity.activity_date || activity.created_at);
        const formattedDate = date.toLocaleDateString('en-IN');
        const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        let icon, iconClass, title, subtitle, amount = '';

        switch (activity.activity_type) {
        case 'income':
            icon = '▲';
            iconClass = 'activity-icon income';
            title = activity.description || 'Income Transaction';
            subtitle = `Credited to: ${activity.account_info || 'Unknown'}`;
            amount = `+₹${parseFloat(activity.amount || 0).toFixed(2)}`;
            break;
        case 'expense':
            icon = '▼';
            iconClass = 'activity-icon expense';
            title = activity.description || 'Expense Transaction';
            subtitle = `Paid via: ${activity.account_info || 'Unknown'}`;
            amount = `-₹${parseFloat(activity.amount || 0).toFixed(2)}`;
            break;
        case 'setup':
            icon = '⚙';
            iconClass = 'activity-icon setup';
            title = activity.description || 'Setup Activity';
            subtitle = 'Account configuration';
            amount = activity.amount ? `₹${parseFloat(activity.amount).toFixed(2)}` : '';
            break;
        default:
            icon = '○';
            iconClass = 'activity-icon other';
            title = activity.description || 'Activity';
            subtitle = 'System activity';
            amount = '';
        }

        return `
            <div class="activity-item">
                <div class="activity-item-icon">
                    <span class="${iconClass}">${icon}</span>
                </div>
                <div class="activity-item-content">
                    <div class="activity-item-header">
                        <h4 class="activity-item-title">${title}</h4>
                        <span class="activity-item-amount ${activity.activity_type}">${amount}</span>
                    </div>
                    <div class="activity-item-details">
                        <p class="activity-item-subtitle">${subtitle}</p>
                        <p class="activity-item-date">${formattedDate} at ${formattedTime}</p>
                    </div>
                </div>
            </div>
        `;
    }

    filterActivity() {

        const typeFilter = document.getElementById('activity-type')?.value || '';
        const dateFromFilter = document.getElementById('activity-date-from')?.value || '';
        const dateToFilter = document.getElementById('activity-date-to')?.value || '';

        this.currentFilters = {
            type: typeFilter,
            dateFrom: dateFromFilter,
            dateTo: dateToFilter
        };

        this.filteredActivities = this.activities.filter(activity => {
            // Type filter
            if (typeFilter && activity.activity_type !== typeFilter) {
                return false;
            }

            // Date range filter
            const activityDate = new Date(activity.activity_date || activity.created_at);

            if (dateFromFilter) {
                const fromDate = new Date(dateFromFilter);
                if (activityDate < fromDate) return false;
            }

            if (dateToFilter) {
                const toDate = new Date(dateToFilter);
                toDate.setHours(23, 59, 59, 999); // End of day
                if (activityDate > toDate) return false;
            }

            return true;
        });

        this.calculateStatistics();
        this.renderActivityStatistics();
        this.renderActivityFeed();

    }

    clearActivityFilters() {

        // Reset filter inputs
        const typeFilter = document.getElementById('activity-type');
        const dateFromFilter = document.getElementById('activity-date-from');
        const dateToFilter = document.getElementById('activity-date-to');

        if (typeFilter) typeFilter.value = '';
        if (dateFromFilter) dateFromFilter.value = '';
        if (dateToFilter) dateToFilter.value = '';

        // Reset filters and show all activities
        this.currentFilters = {
            type: '',
            dateFrom: '',
            dateTo: ''
        };

        this.filteredActivities = [...this.activities];
        this.calculateStatistics();
        this.renderActivityStatistics();
        this.renderActivityFeed();
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
        // Note: renderActivityStatistics and renderActivityFeed are already called in loadActivityData
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

