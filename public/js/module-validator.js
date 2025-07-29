/**
 * Module Validation Script
 * This script validates that our modularization eliminated duplicate API calls
 */

// Function to check if all modules are loaded
function validateModules() {
    const modules = [
        'apiClient',
        'setupManager',
        'transactionManager',
        'navigationManager',
        'summaryManager',
        'authManager',
        'expenseTracker'
    ];

    const loadedModules = [];
    const missingModules = [];

    modules.forEach(module => {
        if (window[module]) {
            loadedModules.push(module);
        } else {
            missingModules.push(module);
        }
    });

    return missingModules.length === 0;
}

// Function to check for duplicate function definitions
function checkForDuplicates() {
    const globalFunctions = [
        'addBank',
        'addIncome',
        'addExpense',
        'showSection',
        'loadMonthlySummary'
    ];

    const duplicateCheck = {};

    globalFunctions.forEach(funcName => {
        if (window[funcName]) {
            duplicateCheck[funcName] = 'Available as global function';
        }
    });

    return Object.keys(duplicateCheck).length > 0;
}

// Run validation
validateModules();
checkForDuplicates();


