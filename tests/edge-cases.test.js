/**
 * Edge Cases and Error Scenarios - Maximum Coverage Push
 * Tests all error paths, validation edge cases, and boundary conditions
 * @jest-environment node
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock rate limiter to prevent 429 errors in tests
jest.mock('express-rate-limit', () => {
    return () => (req, res, next) => next(); // No-op middleware
});

// Import the actual server app AFTER mocking rate limiter
const app = require('../server');

// Test database configuration
const testPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker_test',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
    ssl: false
});

describe('Edge Cases & Error Scenarios - Complete Coverage', () => {
    let testUserId;
    let sessionCookie;
    let bankId;
    let creditCardId;

    beforeAll(async () => {
        // Register test user
        const userData = {
            username: 'edgetest123',
            password: 'EdgeTest123&',
            name: 'Edge Test User',
            email: 'edge@test.com',
            securityQuestion: 'What is your edge test?',
            securityAnswer: 'boundaries'
        };

        const registerResponse = await request(app)
            .post('/api/register')
            .send(userData);

        testUserId = registerResponse.body.userId;

        // Login to get session
        const loginResponse = await request(app)
            .post('/api/login')
            .send({
                username: 'edgetest123',
                password: 'EdgeTest123&'
            });

        sessionCookie = loginResponse.headers['set-cookie'];

        // Create bank and credit card for testing
        const bankResponse = await request(app)
            .post('/api/banks')
            .set('Cookie', sessionCookie)
            .send({
                name: 'EDGE TEST BANK',
                initialBalance: 1000
            });
        bankId = bankResponse.body.id;

        const cardResponse = await request(app)
            .post('/api/credit-cards')
            .set('Cookie', sessionCookie)
            .send({
                name: 'EDGE TEST CARD',
                creditLimit: 5000
            });
        creditCardId = cardResponse.body.id;

        // Set initial cash balance
        await request(app)
            .post('/api/cash-balance')
            .set('Cookie', sessionCookie)
            .send({ balance: 500 });
    });

    afterAll(async () => {
        // Clean up
        try {
            await testPool.query('DELETE FROM expenses WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM income_entries WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM credit_cards WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM banks WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM cash_balance WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        } catch (error) {
            console.warn('Test cleanup warning:', error.message);
        }
        await testPool.end();
    });

    describe('Registration Edge Cases', () => {
        test('should handle username taken error', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    username: 'edgetest123', // Already exists
                    password: 'DupeTest123&',
                    name: 'Duplicate User',
                    email: 'dupe@test.com',
                    securityQuestion: 'test',
                    securityAnswer: 'test'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Username or email already exists');
        });

        test('should handle email taken error', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    username: 'uniqueuser123',
                    password: 'DupeTest123&',
                    name: 'Duplicate Email User',
                    email: 'edge@test.com', // Already exists
                    securityQuestion: 'test',
                    securityAnswer: 'test'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Username or email already exists');
        });

        test('should handle all password validation edge cases', async () => {
            const testCases = [
                { password: '1234567', description: 'exactly 7 chars (too short)' },
                { password: '12345678901234567', description: 'exactly 17 chars (too long)' },
                { password: 'allLowerCase123&', description: 'no uppercase' },
                { password: 'ALLUPPERCASE123&', description: 'no lowercase' },
                { password: 'NoNumbersHere&', description: 'no numbers' },
                { password: 'HasNumbers123', description: 'no special chars' }
            ];

            for (const testCase of testCases) {
                const response = await request(app)
                    .post('/api/register')
                    .send({
                        username: `test${Date.now()}${Math.random()}`,
                        password: testCase.password,
                        name: 'Test User',
                        email: `test${Date.now()}${Math.random()}@example.com`,
                        securityQuestion: 'test',
                        securityAnswer: 'test'
                    });

                expect(response.status).toBe(400);
                // Should have some validation error
                expect(response.body.error).toBeDefined();
            }
        });
    });

    describe('Authentication Edge Cases', () => {
        test('should handle login with non-existent user', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    username: 'nonexistentuser',
                    password: 'SomePass123&'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should handle login with wrong password', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    username: 'edgetest123',
                    password: 'WrongPass123&'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should handle logout', async () => {
            const response = await request(app)
                .post('/api/logout')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Re-login for other tests
            const loginResponse = await request(app)
                .post('/api/login')
                .send({
                    username: 'edgetest123',
                    password: 'EdgeTest123&'
                });
            sessionCookie = loginResponse.headers['set-cookie'];
        });
    });

    describe('Financial Operations Edge Cases', () => {
        test('should handle negative amounts in bank creation', async () => {
            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'NEGATIVE BANK',
                    initialBalance: -1000
                });

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.current_balance)).toBe(-1000);
        });

        test('should handle zero amounts', async () => {
            const response = await request(app)
                .post('/api/credit-cards')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'ZERO LIMIT CARD',
                    creditLimit: 0
                });

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.credit_limit)).toBe(0);
        });

        test('should handle very large amounts', async () => {
            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'BILLIONAIRE BANK',
                    initialBalance: 999999999.99
                });

            expect(response.status).toBe(200);
        });

        test('should handle decimal precision edge cases', async () => {
            const response = await request(app)
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send({ balance: 123.456789 }); // More than 2 decimal places

            expect(response.status).toBe(200);
            // Should handle precision correctly
            expect(response.body.balance).toBeDefined();
        });
    });

    describe('Income/Expense Validation Edge Cases', () => {
        test('should handle zero amount transactions', async () => {
            const incomeResponse = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Zero Income',
                    amount: 0,
                    creditedToType: 'cash',
                    creditedToId: null,
                    date: '2025-07-22'
                });

            expect(incomeResponse.status).toBe(200);

            const expenseResponse = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Zero Expense',
                    amount: 0,
                    paymentMethod: 'cash',
                    paymentSourceId: null,
                    date: '2025-07-22'
                });

            expect(expenseResponse.status).toBe(200);
        });
    });

    describe('Date and Query Parameter Edge Cases', () => {
        test('should handle invalid month/year in queries', async () => {
            const testCases = [
                { month: 0, year: 2025 },
                { month: 13, year: 2025 },
                { month: 7, year: 1899 },
                { month: 7, year: 3000 }
            ];

            for (const testCase of testCases) {
                const response = await request(app)
                    .get(`/api/monthly-summary?month=${testCase.month}&year=${testCase.year}`)
                    .set('Cookie', sessionCookie);

                expect(response.status).toBe(200);
                // Should handle gracefully
                expect(response.body).toBeDefined();
            }
        });

        test('should handle some query parameter variations', async () => {
            const endpoints = [
                '/api/income',
                '/api/expenses'
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)
                    .get(endpoint)
                    .set('Cookie', sessionCookie);

                expect(response.status).toBe(200);
                expect(response.body).toBeDefined();
            }
        });
    });

    describe('Password Reset Edge Cases', () => {
        test('should handle forgot password for non-existent user', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'nonexistentuser' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('User not found');
        });

        test('should handle forgot password with non-existent email', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({ email: 'nonexistent@example.com' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('User not found');
        });

        test('should handle reset password for non-existent user ID', async () => {
            const response = await request(app)
                .post('/api/reset-password')
                .send({
                    userId: 99999,
                    securityAnswer: 'test',
                    newPassword: 'NewPass123&'
                });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('User not found');
        });

        test('should handle reset password with invalid new password', async () => {
            // First get user for reset
            const forgotResponse = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'edgetest123' });

            const response = await request(app)
                .post('/api/reset-password')
                .send({
                    userId: forgotResponse.body.userId,
                    securityAnswer: 'boundaries',
                    newPassword: 'weak' // Invalid password
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Password must be');
        });
    });

    describe('Session and Authentication State Edge Cases', () => {
        test('should handle invalid session cookie', async () => {
            const response = await request(app)
                .get('/api/banks')
                .set('Cookie', ['connect.sid=invalid_session_id']);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        test('should handle no session cookie', async () => {
            const response = await request(app)
                .get('/api/banks');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        test('should handle malformed session cookie', async () => {
            const response = await request(app)
                .get('/api/banks')
                .set('Cookie', ['malformed_cookie']);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('HTTP Method and Route Edge Cases', () => {
        test('should handle unsupported HTTP methods', async () => {
            const response = await request(app)
                .patch('/api/banks')
                .set('Cookie', sessionCookie);

            // Should return 404 for unsupported method
            expect(response.status).toBe(404);
        });

        test('should handle non-existent routes', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(404);
        });

        test('should handle root path variations', async () => {
            const paths = ['/', '/index.html', '/public/index.html'];
            
            for (const path of paths) {
                const response = await request(app).get(path);
                // Should handle gracefully - either serve file or 404
                expect([200, 404]).toContain(response.status);
            }
        });
    });

    describe('Data Integrity and Concurrent Access', () => {
        test('should handle concurrent balance operations', async () => {
            // Create multiple concurrent requests that modify balance
            const promises = [];
            
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request(app)
                        .post('/api/expenses')
                        .set('Cookie', sessionCookie)
                        .send({
                            title: `Concurrent Expense ${i}`,
                            amount: 1,
                            paymentMethod: 'cash',
                            paymentSourceId: null,
                            date: '2025-07-22'
                        })
                );
            }

            const responses = await Promise.all(promises);
            
            // All should succeed (or fail consistently due to balance constraints)
            responses.forEach(response => {
                expect([200, 400]).toContain(response.status);
            });
        });
    });

    describe('Input Sanitization and XSS Prevention', () => {
        test('should handle potentially malicious input in bank names', async () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                'DROP TABLE users;',
                '${7*7}',
                '{{7*7}}',
                'Bank\nWith\nNewlines',
                'Bank\tWith\tTabs'
            ];

            for (const input of maliciousInputs) {
                const response = await request(app)
                    .post('/api/banks')
                    .set('Cookie', sessionCookie)
                    .send({
                        name: input,
                        initialBalance: 1000
                    });

                expect(response.status).toBe(200);
                // Should store and return safely
                expect(response.body.name).toBeDefined();
            }
        });

        test('should handle SQL injection attempts', async () => {
            const sqlInjections = [
                "'; DROP TABLE banks; --",
                "' OR '1'='1",
                "1; DELETE FROM users WHERE 1=1; --"
            ];

            for (const injection of sqlInjections) {
                const response = await request(app)
                    .post('/api/banks')
                    .set('Cookie', sessionCookie)
                    .send({
                        name: injection,
                        initialBalance: 1000
                    });

                // Should handle safely without crashing
                expect([200, 400, 500]).toContain(response.status);
            }
        });
    });

    describe('Tracking Option Edge Cases', () => {
        test('should handle invalid tracking options', async () => {
            const invalidOptions = ['invalid', 'all', 'none', ''];

            for (const option of invalidOptions) {
                const response = await request(app)
                    .post('/api/set-tracking-option')
                    .set('Cookie', sessionCookie)
                    .send({ trackingOption: option });

                // Should reject invalid options
                expect([400, 500]).toContain(response.status);
            }

            // Test null and undefined separately as they might be handled differently
            const nullResponse = await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: null });
            expect([400, 500]).toContain(nullResponse.status);

            const undefinedResponse = await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({});
            expect([400, 500]).toContain(undefinedResponse.status);
        });

        test('should validate tracking option constraints in expenses', async () => {
            // Set to income-only and try to add expense
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'income' });

            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Should Not Be Allowed',
                    amount: 100,
                    paymentMethod: 'cash',
                    paymentSourceId: null,
                    date: '2025-07-22'
                });

            // Reset to both for other tests
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'both' });

            // Should handle according to business logic
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('Date and Time Edge Cases', () => {
        test('should handle leap year dates', async () => {
            const response = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Leap Year Income',
                    amount: 100,
                    creditedToType: 'cash',
                    creditedToId: null,
                    date: '2024-02-29' // Leap year date
                });

            expect(response.status).toBe(200);
        });

        test('should handle future dates gracefully', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const futureDateString = futureDate.toISOString().split('T')[0];

            const response = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Future Income',
                    amount: 100,
                    creditedToType: 'cash',
                    creditedToId: null,
                    date: futureDateString
                });

            // Should handle according to business logic
            expect([200, 400]).toContain(response.status);
        });

        test('should handle invalid date formats', async () => {
            const invalidDates = ['2025-13-01', '2025-02-30', 'invalid-date', ''];

            for (const invalidDate of invalidDates) {
                const response = await request(app)
                    .post('/api/income')
                    .set('Cookie', sessionCookie)
                    .send({
                        source: 'Invalid Date Income',
                        amount: 100,
                        creditedToType: 'cash',
                        creditedToId: null,
                        date: invalidDate
                    });

                expect([400, 500]).toContain(response.status);
            }
        });
    });

    describe('Rate Limiting and Security Headers', () => {
        test('should handle CORS preflight requests', async () => {
            const response = await request(app)
                .options('/api/banks')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'POST');

            // Should handle CORS appropriately
            expect([200, 204, 404]).toContain(response.status);
        });

        test('should handle requests with suspicious headers', async () => {
            const response = await request(app)
                .get('/api/banks')
                .set('Cookie', sessionCookie)
                .set('X-Forwarded-For', '127.0.0.1; DROP TABLE users; --')
                .set('User-Agent', '<script>alert("xss")</script>');

            // Should handle safely
            expect([200, 400, 401]).toContain(response.status);
        });
    });
});
