// Jest setup file
require('@testing-library/jest-dom');

// Set NODE_ENV to test to prevent server from auto-connecting to database
process.env.NODE_ENV = 'test';

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

// Track servers for cleanup
global.__TEST_SERVERS__ = [];

// Reset mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Global cleanup to ensure all handles are closed
afterAll(async () => {
    // Close any tracked servers
    for (const server of global.__TEST_SERVERS__) {
        try {
            if (server && typeof server.close === 'function') {
                await new Promise((resolve) => {
                    server.close(() => {
                        resolve();
                    });
                });
            }
        } catch {
            // Ignore errors during cleanup
        }
    }

    // Clear the server array
    global.__TEST_SERVERS__.length = 0;

    // Close database pools - use a more robust approach
    try {
        // Try to close the db.js pool directly (shared by server and test-helpers)
        const dbPool = require('../db');
        if (dbPool && typeof dbPool.end === 'function' && !dbPool.ended) {
            await dbPool.end();
        }
    } catch {
        // If that fails, try the individual modules
        try {
            const serverModule = require('../server');
            if (serverModule && serverModule.pool && typeof serverModule.pool.end === 'function' && !serverModule.pool.ended) {
                await serverModule.pool.end();
            }
        } catch {
            // Ignore errors if server module not loaded
        }

        try {
            const testHelpers = require('../test-helpers');
            if (testHelpers && typeof testHelpers.closePool === 'function') {
                await testHelpers.closePool();
            }
        } catch {
            // Ignore errors if test helpers not loaded
        }
    }

    // Allow some time for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 300));
});
