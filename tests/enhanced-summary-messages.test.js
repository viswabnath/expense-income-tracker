/**
 * Enhanced Summary Messages Tests
 * Tests for the improved no-transactions messaging system
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock DOM globals
global.fetch = jest.fn();
global.console.log = jest.fn();
global.console.error = jest.fn();

describe('Enhanced Summary Messages Tests', () => {
    let summaryManagerCode;

    beforeAll(() => {
        // Load summary manager code
        const summaryManagerPath = path.join(__dirname, '../public/js/summary-manager.js');
        summaryManagerCode = fs.readFileSync(summaryManagerPath, 'utf8');
    });

    beforeEach(() => {
        // Reset DOM for each test
        document.body.innerHTML = `
            <div id="summary-section">
                <div id="monthly-summary-content">
                    <div id="monthly-income-display">₹0.00</div>
                    <div id="monthly-expense-display">₹0.00</div>
                    <div id="monthly-savings-display">₹0.00</div>
                    <div id="total-wealth-display">₹0.00</div>
                </div>
                <div id="summary-display"></div>
            </div>
        `;

        // Mock fetch
        fetch.mockClear();

        // Clear window objects
        delete window.summaryManager;
        delete window.apiClient;
        delete window.showSection;
    });

    describe('No Transactions Detection', () => {
        test('should contain no transactions check logic', () => {
            expect(summaryManagerCode).toContain('No transactions found');
            expect(summaryManagerCode).toContain('haven\\\'t added any transactions');
        });

        test('should have enhanced messaging for new users', () => {
            expect(summaryManagerCode).toContain('Setup Accounts');
            expect(summaryManagerCode).toContain('primary-button');
            expect(summaryManagerCode).toContain('setup-accounts-btn');
            expect(summaryManagerCode).toContain('add-transactions-btn');
        });
    });
});
