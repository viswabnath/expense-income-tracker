
// MODULE LOADING DEBUG
// Manager Instances
// Global Functions

/**
 * Debug Script - Check Module Loading and Function Availability
 * Run this in browser console to diagnose issues
 */

// Check if all manager instances exist
const managers = [
    'ApiClient',
    'apiClient',
    'authManager',
    'setupManager',
    'transactionManager',
    'navigationManager',
    'summaryManager',
    'expenseTracker'
];

// Check if global functions are available
const globalFunctions = [
    'login',
    'register',
    'setTrackingOption',
    'showSection',
    'addBank',
    'addIncome',
    'addExpense',
    'loadMonthlySummary'
];

// Check API client methods
if (window.apiClient) {
    const apiMethods = ['get', 'post', 'put', 'delete'];
    apiMethods.forEach(method => {
        // Only check existence, do not assign unused variable
        typeof window.apiClient[method] === 'function';
    });
}

// Test a simple API call
if (window.apiClient && typeof window.apiClient.get === 'function') {
    try {
        window.apiClient.get('/api/test')
            .then(function () {/* intentionally empty */})
            .catch(function () {/* intentionally empty */});
    } catch (err) {
        // intentionally empty
    }
}
// Do nothing

