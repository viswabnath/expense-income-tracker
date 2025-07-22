/**
 * Debug Script - Check Module Loading and Function Availability
 * Run this in browser console to diagnose issues
 */

console.log('=== MODULE LOADING DEBUG ===');

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

console.log('Manager Instances:');
managers.forEach(manager => {
    const exists = window[manager] !== undefined;
    console.log(`  ${manager}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    if (exists && typeof window[manager] === 'object') {
        console.log(`    Type: ${typeof window[manager]}`);
        if (window[manager].constructor) {
            console.log(`    Constructor: ${window[manager].constructor.name}`);
        }
    }
});

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

console.log('\nGlobal Functions:');
globalFunctions.forEach(func => {
    const exists = typeof window[func] === 'function';
    console.log(`  ${func}: ${exists ? '✅ AVAILABLE' : '❌ MISSING'}`);
});

// Check API client methods
console.log('\nAPI Client Methods:');
if (window.apiClient) {
    const apiMethods = ['get', 'post', 'put', 'delete'];
    apiMethods.forEach(method => {
        const exists = typeof window.apiClient[method] === 'function';
        console.log(`  apiClient.${method}: ${exists ? '✅ AVAILABLE' : '❌ MISSING'}`);
    });
} else {
    console.log('  ❌ apiClient not found');
}

// Test a simple API call
console.log('\nTesting API Client:');
if (window.apiClient && typeof window.apiClient.get === 'function') {
    try {
        window.apiClient.get('/api/test')
            .then(() => console.log('  ✅ API client working'))
            .catch(err => console.log(`  ⚠️ API call failed (expected): ${err.message}`));
    } catch (err) {
        console.log(`  ❌ API client error: ${err.message}`);
    }
} else {
    console.log('  ❌ Cannot test API client - methods missing');
}

console.log('\n=== END DEBUG ===');
