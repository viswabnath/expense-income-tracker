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
            activityList.innerHTML = '<p class="no-data">No activities found</p>';
            return;
        }

        // Sort activities by date (newest first)
        const sortedActivities = [...this.filteredActivities].sort((a, b) => {
            const dateA = new Date(a.activity_date || a.created_at);
            const dateB = new Date(b.activity_date || b.created_at);
            return dateB - dateA;
        });

        // Create simple HTML table
        let tableHTML = `
            <table class="activity-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedActivities.forEach(activity => {
            tableHTML += this.renderActivityRow(activity);
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        activityList.innerHTML = tableHTML;
    }

    renderActivityRow(activity) {
        const date = new Date(activity.activity_date || activity.created_at);
        const formattedDate = date.toLocaleDateString('en-IN');

        // Determine action based on activity type
        let action, type, description, amount, details;

        switch (activity.activity_type) {
            case 'income':
                action = 'Add Income';
                type = 'Income';
                description = activity.description || 'Income Transaction';
                amount = `₹${parseFloat(activity.amount || 0).toFixed(2)}`;
                details = activity.account_info || 'Unknown Account';
                break;
            case 'expense':
                action = 'Add Expense';
                type = 'Expense';
                description = activity.description || 'Expense Transaction';
                amount = `₹${parseFloat(activity.amount || 0).toFixed(2)}`;
                details = activity.account_info || 'Unknown Account';
                break;
            case 'setup':
                action = 'Setup';
                type = 'Setup';
                description = activity.description || 'Account Setup';
                amount = activity.amount ? `₹${parseFloat(activity.amount).toFixed(2)}` : '-';
                details = 'Account Configuration';
                break;
            default:
                action = 'Other';
                type = 'System';
                description = activity.description || 'System Activity';
                amount = '-';
                details = 'System Operation';
        }

        return `
            <tr class="activity-row ${activity.activity_type}">
                <td class="activity-date">${formattedDate}</td>
                <td class="activity-action">${action}</td>
                <td class="activity-type">${type}</td>
                <td class="activity-description">${description}</td>
                <td class="activity-amount">${amount}</td>
                <td class="activity-details">${details}</td>
            </tr>
        `;
    }

    filterActivity() {
        const monthFilter = document.getElementById('activity-month')?.value || '';
        const yearFilter = document.getElementById('activity-year')?.value || '';

        this.filteredActivities = this.activities.filter(activity => {
            const activityDate = new Date(activity.activity_date || activity.created_at);
            
            // Month filter (1-12)
            if (monthFilter && (activityDate.getMonth() + 1) !== parseInt(monthFilter)) {
                return false;
            }

            // Year filter
            if (yearFilter && activityDate.getFullYear() !== parseInt(yearFilter)) {
                return false;
            }

            return true;
        });

        this.calculateStatistics();
        this.renderActivityStatistics();
        this.renderActivityFeed();
    }

    clearActivityFilters() {
        // Reset filter inputs
        const monthFilter = document.getElementById('activity-month');
        const yearFilter = document.getElementById('activity-year');

        if (monthFilter) monthFilter.value = '';
        if (yearFilter) yearFilter.value = '';

        // Reset filters and show all activities
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

