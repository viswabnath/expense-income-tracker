/**
 * Integration Tests - Real Server Testing
 * Tests actual endpoints with real database connections
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
    database: process.env.DB_NAME || 'expense_tracker_test', // Use test database
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
    ssl: false
});

describe('Integration Tests - Server Endpoints', () => {
    let testUserId;
    let sessionCookie;

    // Setup and cleanup
    beforeAll(async () => {
        // Create test tables if they don't exist (simplified version)
        try {
            await testPool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    security_question VARCHAR(255) NOT NULL,
                    security_answer_hash VARCHAR(255) NOT NULL,
                    tracking_option VARCHAR(20) DEFAULT 'both',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await testPool.query(`
                CREATE TABLE IF NOT EXISTS banks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    initial_balance DECIMAL(15,2) DEFAULT 0,
                    current_balance DECIMAL(15,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, name)
                )
            `);

            await testPool.query(`
                CREATE TABLE IF NOT EXISTS cash_balance (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                    balance DECIMAL(15,2) DEFAULT 0,
                    initial_balance DECIMAL(15,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (error) {
            console.warn('Test database setup warning:', error.message);
        }
    });

    afterAll(async () => {
        // Cleanup test data
        try {
            await testPool.query('DELETE FROM banks WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM cash_balance WHERE user_id = $1', [testUserId]);
            await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        } catch (error) {
            console.warn('Test cleanup warning:', error.message);
        }
        await testPool.end();
    });

    describe('Authentication Endpoints', () => {
        test('GET / should serve the main HTML file', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.type).toBe('text/html');
        });

        test('POST /api/register should create a new user', async () => {
            const userData = {
                username: 'testuser123',
                password: 'TestPass123&',
                name: 'Test User',
                email: 'test@example.com',
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'Fluffy'
            };

            const response = await request(app)
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.userId).toBeDefined();

            testUserId = response.body.userId;
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

            const response = await request(app)
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Password must');
        });

        test('POST /api/login should authenticate valid user', async () => {
            const loginData = {
                username: 'testuser123',
                password: 'TestPass123&'
            };

            const response = await request(app)
                .post('/api/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.name).toBe('Test User');
            expect(response.body.trackingOption).toBeDefined();

            // Store session cookie for authenticated requests
            sessionCookie = response.headers['set-cookie'];
        });

        test('POST /api/login should reject invalid credentials', async () => {
            const loginData = {
                username: 'testuser123',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/login')
                .send(loginData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });
    });

    describe('Protected Endpoints (Require Authentication)', () => {
        test('GET /api/user should return user info when authenticated', async () => {
            const response = await request(app)
                .get('/api/user')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Test User');
            expect(response.body.tracking_option).toBeDefined();
        });

        test('GET /api/user should require authentication', async () => {
            const response = await request(app)
                .get('/api/user');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        test('POST /api/banks should create a bank account', async () => {
            const bankData = {
                name: 'TEST BANK',
                initialBalance: 1000
            };

            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send(bankData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('TEST BANK');
            expect(parseFloat(response.body.initial_balance)).toBe(1000);
        });

        test('GET /api/banks should return user banks', async () => {
            const response = await request(app)
                .get('/api/banks')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].name).toBe('TEST BANK');
        });

        test('POST /api/cash-balance should set cash balance', async () => {
            const cashData = {
                balance: 500
            };

            const response = await request(app)
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send(cashData);

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(500);
            expect(parseFloat(response.body.initial_balance)).toBe(500);
        });

        test('GET /api/cash-balance should return cash balance', async () => {
            const response = await request(app)
                .get('/api/cash-balance')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(500);
        });

        test('POST /api/set-tracking-option should update tracking preference', async () => {
            const trackingData = {
                trackingOption: 'income'
            };

            const response = await request(app)
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

            const response = await request(app)
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
            const response = await request(app)
                .get('/api/monthly-summary')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Month and year are required');
        });

        test('GET /api/monthly-summary should handle future dates', async () => {
            const futureYear = new Date().getFullYear() + 1;

            const response = await request(app)
                .get(`/api/monthly-summary?month=1&year=${futureYear}`)
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Future date');
        });
    });

    describe('Password Reset Flow', () => {
        test('POST /api/forgot-username should find username by email', async () => {
            const response = await request(app)
                .post('/api/forgot-username')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.username).toBe('testuser123');
            expect(response.body.name).toBe('Test User');
        });

        test('POST /api/forgot-password should return security question', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'testuser123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.securityQuestion).toBe('What is your pet name?');
            expect(response.body.userId).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('Should handle duplicate username registration', async () => {
            const userData = {
                username: 'testuser123', // Duplicate username
                password: 'TestPass123&',
                name: 'Another User',
                email: 'another@example.com',
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'Fluffy'
            };

            const response = await request(app)
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Username or email already exists');
        });

        test('Should handle malformed requests', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({}); // Empty data

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('All fields are required');
        });
    });

    describe('Session Management', () => {
        test('POST /api/logout should destroy session', async () => {
            const response = await request(app)
                .post('/api/logout')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('Should require new login after logout', async () => {
            const response = await request(app)
                .get('/api/user')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
