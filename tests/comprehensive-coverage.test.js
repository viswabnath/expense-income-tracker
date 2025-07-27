/**
 * Comprehensive Integration Tests - Maximum Coverage
 * Tests all server endpoints and edge cases for maximum coverage
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

describe('Comprehensive Coverage Tests', () => {
    let testUserId;
    let sessionCookie;
    let bankId;
    let creditCardId;

    // Setup test database and user
    beforeAll(async () => {
        // Create all required tables
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
                CREATE TABLE IF NOT EXISTS credit_cards (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    credit_limit DECIMAL(15,2) DEFAULT 0,
                    used_limit DECIMAL(15,2) DEFAULT 0,
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

            await testPool.query(`
                CREATE TABLE IF NOT EXISTS income_entries (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    source VARCHAR(255) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    credited_to_type VARCHAR(50) NOT NULL,
                    credited_to_id INTEGER,
                    date DATE NOT NULL,
                    month INTEGER NOT NULL,
                    year INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await testPool.query(`
                CREATE TABLE IF NOT EXISTS expenses (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    payment_method VARCHAR(50) NOT NULL,
                    payment_source_id INTEGER,
                    date DATE NOT NULL,
                    month INTEGER NOT NULL,
                    year INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (error) {
            console.warn('Test database setup warning:', error.message);
        }
    });

    afterAll(async () => {
        // Comprehensive cleanup
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

    describe('User Registration & Authentication - Complete Coverage', () => {
        test('should register user and set up session', async () => {
            const userData = {
                username: 'covtest123',
                password: 'CovTest123&',
                name: 'Coverage Test User',
                email: 'coverage@test.com',
                securityQuestion: 'What is your favorite test?',
                securityAnswer: 'coverage'
            };

            const response = await request(app)
                .post('/api/register')
                .send(userData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.userId).toBeDefined();
            
            testUserId = response.body.userId;
        });

        test('should login and get session cookie', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    username: 'covtest123',
                    password: 'CovTest123&'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            sessionCookie = response.headers['set-cookie'];
        });

        test('should test all password validation branches', async () => {
            const testCases = [
                { password: 'short', error: 'Password must be between 8 and 16 characters long' },
                { password: 'thispasswordiswaytoolongtobevalid', error: 'Password must be between 8 and 16 characters long' },
                { password: 'NOLOWERCASE123&', error: 'Password must contain at least one lowercase letter' },
                { password: 'nouppercase123&', error: 'Password must contain at least one uppercase letter' },
                { password: 'NoNumbers&', error: 'Password must contain at least one number' },
                { password: 'NoSpecialChar123', error: 'Password must contain at least one special character (_, -, @, :,or &)' },
                { password: 'InvalidChar123!', error: 'Password must contain at least one special character (_, -, @, :,or &)' }
            ];

            for (const testCase of testCases) {
                const response = await request(app)
                    .post('/api/register')
                    .send({
                        username: `test${Date.now()}`,
                        password: testCase.password,
                        name: 'Test User',
                        email: `test${Date.now()}@example.com`,
                        securityQuestion: 'test',
                        securityAnswer: 'test'
                    });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe(testCase.error);
            }
        });

        test('should test all validation error paths', async () => {
            // Test invalid email
            const invalidEmailResponse = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser999',
                    password: 'ValidPass123&',
                    name: 'Test User',
                    email: 'invalid-email',
                    securityQuestion: 'test',
                    securityAnswer: 'test'
                });
            expect(invalidEmailResponse.status).toBe(400);
            expect(invalidEmailResponse.body.error).toBe('Invalid email format');

            // Test invalid username
            const invalidUsernameResponse = await request(app)
                .post('/api/register')
                .send({
                    username: 'test@user',
                    password: 'ValidPass123&',
                    name: 'Test User',
                    email: 'test999@example.com',
                    securityQuestion: 'test',
                    securityAnswer: 'test'
                });
            expect(invalidUsernameResponse.status).toBe(400);
            expect(invalidUsernameResponse.body.error).toBe('Username can only contain letters, numbers, and underscores');
        });
    });

    describe('Financial Operations - Complete Coverage', () => {
        test('should create bank account', async () => {
            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'COVERAGE TEST BANK',
                    initialBalance: 5000
                });

            expect(response.status).toBe(200);
            bankId = response.body.id;
        });

        test('should create credit card', async () => {
            const response = await request(app)
                .post('/api/credit-cards')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'COVERAGE TEST CARD',
                    creditLimit: 10000
                });

            expect(response.status).toBe(200);
            creditCardId = response.body.id;
        });

        test('should handle duplicate bank creation', async () => {
            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'COVERAGE TEST BANK', // Duplicate
                    initialBalance: 1000
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Bank already exists');
        });

        test('should handle duplicate credit card creation', async () => {
            const response = await request(app)
                .post('/api/credit-cards')
                .set('Cookie', sessionCookie)
                .send({
                    name: 'COVERAGE TEST CARD', // Duplicate
                    creditLimit: 5000
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Credit card already exists');
        });

        test('should set initial cash balance', async () => {
            const response = await request(app)
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send({ balance: 2000 });

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(2000);
        });

        test('should update existing cash balance', async () => {
            const response = await request(app)
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send({ balance: 3000 });

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.balance)).toBe(3000);
        });
    });

    describe('Income Operations - Complete Coverage', () => {
        test('should add income to bank', async () => {
            const response = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Test Salary',
                    amount: 1000,
                    creditedToType: 'bank',
                    creditedToId: bankId,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);
            expect(parseFloat(response.body.amount)).toBe(1000);
        });

        test('should add income to cash', async () => {
            const response = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Test Cash Income',
                    amount: 500,
                    creditedToType: 'cash',
                    creditedToId: null,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);
        });

        test('should get income entries', async () => {
            const response = await request(app)
                .get('/api/income?month=7&year=2025')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });

        test('should get all income entries without filters', async () => {
            const response = await request(app)
                .get('/api/income')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Expense Operations - Complete Coverage', () => {
        test('should add expense from bank (with balance validation)', async () => {
            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Test Bank Expense',
                    amount: 200,
                    paymentMethod: 'bank',
                    paymentSourceId: bankId,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);
        });

        test('should add expense from cash', async () => {
            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Test Cash Expense',
                    amount: 100,
                    paymentMethod: 'cash',
                    paymentSourceId: null,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);
        });

        test('should add expense from credit card', async () => {
            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Test Credit Card Expense',
                    amount: 300,
                    paymentMethod: 'credit_card',
                    paymentSourceId: creditCardId,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);
        });

        test('should test expense validation for expense-only users', async () => {
            // Change tracking option to expenses only
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'expenses' });

            // Should allow expense without balance validation
            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Test Expense Only User',
                    amount: 10000, // Large amount that would fail balance validation
                    paymentMethod: 'bank',
                    paymentSourceId: bankId,
                    date: '2025-07-22'
                });

            expect(response.status).toBe(200);

            // Reset to both
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'both' });
        });

        test('should reject expenses with insufficient balance for both/income users', async () => {
            // Test insufficient bank balance
            const bankResponse = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Too Expensive Bank',
                    amount: 999999, // Way more than available
                    paymentMethod: 'bank',
                    paymentSourceId: bankId,
                    date: '2025-07-22'
                });

            expect(bankResponse.status).toBe(400);
            expect(bankResponse.body.error).toBe('Insufficient bank balance');

            // Test insufficient cash balance
            const cashResponse = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Too Expensive Cash',
                    amount: 999999,
                    paymentMethod: 'cash',
                    paymentSourceId: null,
                    date: '2025-07-22'
                });

            expect(cashResponse.status).toBe(400);
            expect(cashResponse.body.error).toBe('Insufficient cash balance');

            // Test insufficient credit limit
            const creditResponse = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Too Expensive Credit',
                    amount: 999999,
                    paymentMethod: 'credit_card',
                    paymentSourceId: creditCardId,
                    date: '2025-07-22'
                });

            expect(creditResponse.status).toBe(400);
            expect(creditResponse.body.error).toBe('Insufficient credit limit');
        });

        test('should get expense entries with filters', async () => {
            const response = await request(app)
                .get('/api/expenses?month=7&year=2025')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Password Reset Flow - Complete Coverage', () => {
        test('should handle forgot username with email', async () => {
            const response = await request(app)
                .post('/api/forgot-username')
                .send({ email: 'coverage@test.com' });

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('covtest123');
        });

        test('should handle forgot username with invalid email', async () => {
            const response = await request(app)
                .post('/api/forgot-username')
                .send({ email: 'nonexistent@test.com' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('No account found with this email address');
        });

        test('should handle forgot password with username', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'covtest123' });

            expect(response.status).toBe(200);
            expect(response.body.securityQuestion).toBeDefined();
        });

        test('should handle forgot password with email', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({ email: 'coverage@test.com' });

            expect(response.status).toBe(200);
            expect(response.body.securityQuestion).toBeDefined();
        });

        test('should handle reset password with valid security answer', async () => {
            // First get user ID from forgot password
            const forgotResponse = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'covtest123' });

            const response = await request(app)
                .post('/api/reset-password')
                .send({
                    userId: forgotResponse.body.userId,
                    securityAnswer: 'coverage',
                    newPassword: 'NewCovTest123&'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should reject reset password with invalid security answer', async () => {
            const forgotResponse = await request(app)
                .post('/api/forgot-password')
                .send({ username: 'covtest123' });

            const response = await request(app)
                .post('/api/reset-password')
                .send({
                    userId: forgotResponse.body.userId,
                    securityAnswer: 'wrong answer',
                    newPassword: 'NewPass123&'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Incorrect security answer');
        });
    });

    describe('Monthly Summary - Complete Coverage', () => {
        test('should get comprehensive monthly summary', async () => {
            const response = await request(app)
                .get('/api/monthly-summary?month=7&year=2025')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.monthlyIncome).toBeDefined();
            expect(response.body.totalCurrentWealth).toBeDefined();
            expect(response.body.totalExpenses).toBeDefined();
            expect(response.body.banks).toBeDefined();
            expect(response.body.creditCards).toBeDefined();
            expect(response.body.trackingOption).toBeDefined();
        });

        test('should handle past month summary', async () => {
            const response = await request(app)
                .get('/api/monthly-summary?month=6&year=2025')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.isCurrentMonth).toBe(false);
            expect(response.body.isMonthCompleted).toBe(true);
        });

        test('should handle pre-registration date', async () => {
            const response = await request(app)
                .get('/api/monthly-summary?month=1&year=2020')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Date before registration');
        });

        test('should test credit card visibility based on tracking option', async () => {
            // Set to income only
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'income' });

            const incomeOnlyResponse = await request(app)
                .get('/api/monthly-summary?month=7&year=2025')
                .set('Cookie', sessionCookie);

            expect(incomeOnlyResponse.body.creditCards).toEqual([]);

            // Set back to both
            await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'both' });

            const bothResponse = await request(app)
                .get('/api/monthly-summary?month=7&year=2025')
                .set('Cookie', sessionCookie);

            expect(Array.isArray(bothResponse.body.creditCards)).toBe(true);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle all validation error paths', async () => {
            // Test missing fields in forgot password
            const response1 = await request(app)
                .post('/api/forgot-password')
                .send({});

            expect(response1.status).toBe(400);
            expect(response1.body.error).toBe('Username or email is required');

            // Test user not found in reset password
            const response2 = await request(app)
                .post('/api/reset-password')
                .send({
                    userId: 99999, // Non-existent user
                    securityAnswer: 'test',
                    newPassword: 'NewPass123&'
                });

            expect(response2.status).toBe(404);
        });

        test('should require authentication for protected endpoints', async () => {
            const endpoints = [
                { method: 'get', url: '/api/banks' },
                { method: 'get', url: '/api/credit-cards' },
                { method: 'get', url: '/api/cash-balance' },
                { method: 'get', url: '/api/income' },
                { method: 'get', url: '/api/expenses' }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.url);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            }
        });
    });

    describe('Static File Serving', () => {
        test('should serve main HTML file', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.type).toBe('text/html');
        });
    });
});
