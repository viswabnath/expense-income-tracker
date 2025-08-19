// Jest setup file
require('@testing-library/jest-dom');

// Fix for TextEncoder/TextDecoder in Node.js
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock fetch globally
global.fetch = jest.fn();

// Mock DOM elements that might not exist in tests
global.document = {
    getElementById: jest.fn(() => {
        const mockElement = {
            value: '',
            textContent: '',
            className: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                toggle: jest.fn(),
            },
            addEventListener: jest.fn(),
        };
        return mockElement;
    })
};

// Reset mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Global cleanup to ensure all handles are closed
afterAll(async () => {
    // Allow some time for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force close any remaining handles
    const used = process.memoryUsage();
    for (let key in used) {
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
});
