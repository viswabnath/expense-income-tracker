/**
 * Debug test for smart cash button
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Debug Smart Cash Button', () => {
    let setupManagerCode;

    beforeAll(() => {
        const setupManagerPath = path.join(__dirname, '../public/js/setup-manager.js');
        setupManagerCode = fs.readFileSync(setupManagerPath, 'utf8');
    });

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="setup-modal">
                <div id="cash-display"></div>
            </div>
        `;

        // Clear window objects
        delete window.setupManager;
        delete window.apiClient;

        global.fetch = jest.fn();
        global.console.log = jest.fn();
        global.console.error = jest.fn();
    });

    test('debug cash button creation', async () => {
        // Mock API client
        window.apiClient = {
            get: jest.fn().mockResolvedValue({
                success: true,
                balance: 1500.50
            })
        };

        // Load setup manager
        eval(setupManagerCode);

        await window.setupManager.loadCashBalance();

        const cashDiv = document.getElementById('cash-display');
        const editBtn = document.querySelector('[data-action="edit-cash-balance"]');

        console.log('Cash Div HTML:', cashDiv.innerHTML);
        console.log('Button exists:', !!editBtn);
        console.log('Button HTML:', editBtn?.outerHTML);
        console.log('Has disabled attribute:', editBtn?.hasAttribute('disabled'));
        console.log('Disabled property:', editBtn?.disabled);

        const balance = 1500.50;
        const isZeroBalance = balance === 0;
        console.log('Balance:', balance);
        console.log('Is zero balance:', isZeroBalance);
        console.log('Expected disabled HTML:', isZeroBalance ? 'disabled' : '');
    });
});
