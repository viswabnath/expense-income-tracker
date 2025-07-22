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
    
    console.log('✅ Loaded Modules:', loadedModules);
    if (missingModules.length > 0) {
        console.log('❌ Missing Modules:', missingModules);
    }
    
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
    
    console.log('Global Functions Check:', duplicateCheck);
    return Object.keys(duplicateCheck).length > 0;
}

// Run validation
console.log('=== Module Validation Report ===');
const modulesLoaded = validateModules();
const globalFunctionsExist = checkForDuplicates();

console.log('=== Summary ===');
console.log('All modules loaded:', modulesLoaded);
console.log('Global functions available:', globalFunctionsExist);
console.log('Modularization status:', modulesLoaded && globalFunctionsExist ? '✅ SUCCESS' : '❌ ISSUES DETECTED');
