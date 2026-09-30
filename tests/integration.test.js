/**
 * Integration Tests - Real Server Testing
 * Tests actual endpoints with real database connections
 * @jest-environment node
 */

const request = require('supertest');

// Mock rate limiter to prevent 429 errors in tests
jest.mock('express-rate-limit', () => {
    return () => (req, res, next) => next(); // No-op middleware
});

// Import the actual server app AFTER mocking rate limiter
const { target, closeTarget } = require('./api-target');

// Test helpers for database operations
const { setupTestEnvironment, createTestUser, deleteTestUser, query } = require('../test-helpers');

describe('Integration Tests - Server Endpoints', () => {
    let testUserId;
    let sessionCookie;
    let testEnvironment;

    // Setup test environment before all tests
    beforeAll(async () => {
        testEnvironment = await setupTestEnvironment();
        testUserId = testEnvironment.user.id;
    });

    // Clean up after all tests - only if explicitly needed
    afterAll(async () => {
        // Note: Database pool cleanup is handled in the global Jest setup
        // Data is preserved for local development
        await closeTarget();
    });

    // Helper function to ensure authentication
    const ensureAuthentication = async () => {
        if (!sessionCookie) {
            // Login using the test user that was already created
            const loginData = {
                username: 'testuser',
                password: 'TestPass123&'
            };

            const loginResponse = await request(target())
                .post('/api/login')
                .send(loginData);

            if (loginResponse.status === 200) {
                sessionCookie = loginResponse.headers['set-cookie'];
            }
        }
    };

    describe('Authentication Endpoints', () => {
        test('GET / should serve the main HTML file', async () => {
            const response = await request(target()).get('/');

            expect(response.status).toBe(200);
            expect(response.type).toBe('text/html');
        });

        test('POST /api/register should create a new user', async () => {
            const userData = {
                username: 'newtestuser' + Date.now(), // Make username unique
                password: 'TestPass123&',
                name: 'New Test User',
                email: `newtest${Date.now()}@example.com`, // Make email unique
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'Fluffy'
            };

            const response = await request(target())
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.userId).toBeDefined();
        });

        test('POST /api/register should reject invalid password', async () => {
            const userData = {
                username: 'testuser456',
                password: 'weak', // Invalid password
                name: 'Test User',
                email: 'test2@example.com',
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'Fluffy'
            };

            const response = await request(target())
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Password must');
        });

        test('POST /api/login should authenticate with valid credentials', async () => {
            const loginData = {
                username: 'testuser',
                password: 'TestPass123&'
            };

            const response = await request(target())
                .post('/api/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.userId).toBe(testUserId);

            sessionCookie = response.headers['set-cookie'];
        });

        test('POST /api/login should reject invalid credentials', async () => {
            const loginData = {
                username: 'testuser123',
                password: 'wrongpassword'
            };

            const response = await request(target())
                .post('/api/login')
                .send(loginData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });
    });

    describe('Protected Endpoints (Require Authentication)', () => {
        // Ensure authentication before each test in this section
        beforeEach(async () => {
            await ensureAuthentication();
        });
        test('GET /api/user should return user info when authenticated', async () => {
            const response = await request(target())
                .get('/api/user')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Test User');
            expect(response.body.tracking_option).toBeDefined();
        });

        test('GET /api/user should require authentication', async () => {
            const response = await request(target())
                .get('/api/user');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        test('POST /api/banks should create a bank account', async () => {
            const bankData = {
                name: 'TEST BANK ' + Date.now(), // Make bank name unique
                initialBalance: 1000
            };

            const response = await request(target())
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send(bankData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(bankData.name);
            expect(parseFloat(response.body.initial_balance)).toBe(1000);
        });

        test('GET /api/banks should return user banks', async () => {
            const response = await request(target())
                .get('/api/banks')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].name).toBe('Test Bank');
        });

        test('POST /api/cash-balance should set cash balance', async () => {
            const cashData = {
                balance: 500
            };

            const response = await request(target())
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send(cashData);

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(500);
            expect(parseFloat(response.body.initial_balance)).toBe(500);
        });

        test('GET /api/cash-balance should return cash balance', async () => {
            const response = await request(target())
                .get('/api/cash-balance')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(500);
        });

        test('POST /api/set-tracking-option should update tracking preference', async () => {
            const trackingData = {
                trackingOption: 'income'
            };

            const response = await request(target())
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send(trackingData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('Monthly Summary Endpoint', () => {
        test('GET /api/monthly-summary should return summary data', async () => {
            const currentDate = new Date();
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();

            const response = await request(target())
                .get(`/api/monthly-summary?month=${month}&year=${year}`)
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.monthlyIncome).toBeDefined();
            expect(response.body.totalCurrentWealth).toBeDefined();
            expect(response.body.totalExpenses).toBeDefined();
            expect(response.body.trackingOption).toBeDefined();
            expect(response.body.isCurrentMonth).toBeDefined();
            expect(response.body.isMonthCompleted).toBeDefined();
        });

        test('GET /api/monthly-summary should require month and year', async () => {
            const response = await request(target())
                .get('/api/monthly-summary')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Month and year are required');
        });

        test('GET /api/monthly-summary should handle future dates', async () => {
            const futureYear = new Date().getFullYear() + 1;

            const response = await request(target())
                .get(`/api/monthly-summary?month=1&year=${futureYear}`)
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Future date');
        });
    });

    describe('Password Reset Flow', () => {
        test('POST /api/forgot-username should find username by email', async () => {
            const response = await request(target())
                .post('/api/forgot-username')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.username).toBe('testuser');
            expect(response.body.name).toBe('Test User');
        });

        test('POST /api/forgot-password should return security question', async () => {
            const response = await request(target())
                .post('/api/forgot-password')
                .send({ username: 'testuser' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.securityQuestion).toBe('What is your pet name?');
            expect(response.body.userId).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('Should handle duplicate username registration', async () => {
            const userData = {
                username: 'testuser', // Use the existing test user's username
                password: 'TestPass123&',
                name: 'Another User',
                email: 'another@example.com',
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'Fluffy'
            };

            const response = await request(target())
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Username or email already exists');
        });

        test('Should handle malformed requests', async () => {
            const response = await request(target())
                .post('/api/register')
                .send({}); // Empty data

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('All fields are required');
        });
    });

    describe('Session Management', () => {
        test('POST /api/logout should destroy session', async () => {
            const response = await request(target())
                .post('/api/logout')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('Should require new login after logout', async () => {
            const response = await request(target())
                .get('/api/user')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('Activity Type Filter', () => {
        test('should treat type as a value, not SQL (no cross-user leak)', async () => {
            await deleteTestUser('otheruser_sqli');
            const otherUser = await createTestUser({ username: 'otheruser_sqli', email: 'sqli@example.com' });
            await query(
                'INSERT INTO activity_log (user_id, action_type, entity_type, entity_id, description, amount) VALUES ($1, $2, $3, $4, $5, $6)',
                [otherUser.id, 'created', 'bank', 1, 'OTHER USER SECRET', 1]
            );

            try {
                // Fresh login: the shared sessionCookie is logged out by earlier tests
                const loginResponse = await request(target())
                    .post('/api/login')
                    .send({ username: 'testuser', password: 'TestPass123&' });
                expect(loginResponse.status).toBe(200);

                const response = await request(target())
                    .get('/api/activity')
                    .query({ type: 'x\' OR \'1\'=\'1' })
                    .set('Cookie', loginResponse.headers['set-cookie']);

                expect(response.status).toBe(200);
                expect(response.body.activities).toEqual([]);
            } finally {
                await deleteTestUser('otheruser_sqli');
            }
        });
    });
});
