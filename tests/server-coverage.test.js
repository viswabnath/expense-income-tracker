/**
 * Server Coverage Tests - Target specific uncovered lines
 * Focus on getting server.js coverage above 80%
 * @jest-environment node
 */

const request = require('supertest');

// Mock rate limiter
jest.mock('express-rate-limit', () => {
    return () => (req, res, next) => next();
});

// Mock bcrypt
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2a$10$mockedhash'),
    compare: jest.fn().mockResolvedValue(true)
}));

// Mock session store
jest.mock('connect-pg-simple', () => {
    return (session) => {
        return class MockPGSession {
            constructor(options) {
                this.options = options;
            }
            
            get(sid, callback) {
                callback(null, null);
            }
            
            set(sid, session, callback) {
                callback(null);
            }
            
            destroy(sid, callback) {
                callback(null);
            }
            
            touch(sid, session, callback) {
                callback(null);
            }
            
            on(event, callback) {
                // Mock event emitter
            }
        };
    };
});

// Mock database with comprehensive coverage
jest.mock('pg', () => {
    const mockQuery = jest.fn();
    const mockEnd = jest.fn().mockResolvedValue(undefined);

    let entities = {
        users: [{ 
            id: 1, 
            username: 'testuser', 
            password_hash: '$2a$10$testhash',
            name: 'Test User',
            email: 'test@test.com',
            tracking_option: 'both',
            security_question: 'Test?',
            security_answer_hash: '$2a$10$testhash',
            registration_date: '2025-07-01'
        }],
        banks: [{ id: 1, user_id: 1, name: 'Test Bank', current_balance: 5000 }],
        credit_cards: [{ id: 1, user_id: 1, name: 'Test Card', balance: 1000 }],
        cash_balance: [{ user_id: 1, balance: 2000 }],
        income_entries: [{ id: 1, user_id: 1, source: 'Salary', amount: 3000, created_at: '2025-07-15' }],
        expenses: [{ id: 1, user_id: 1, title: 'Food', amount: 100, created_at: '2025-07-15' }]
    };
    
    mockQuery.mockImplementation((query, params = []) => {
        // User operations
        if (query.includes('SELECT id, password_hash, name, tracking_option FROM users WHERE username')) {
            return Promise.resolve({ rows: entities.users, rowCount: 1 });
        }
        if (query.includes('INSERT INTO users')) {
            const newUser = { id: 2, username: params[0] };
            return Promise.resolve({ rows: [newUser], rowCount: 1 });
        }
        if (query.includes('SELECT * FROM users WHERE username = $1 OR email = $2')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (query.includes('SELECT registration_date FROM users WHERE id')) {
            return Promise.resolve({ rows: [{ registration_date: '2025-07-01' }], rowCount: 1 });
        }

        // Bank operations
        if (query.includes('SELECT * FROM banks WHERE user_id')) {
            return Promise.resolve({ rows: entities.banks, rowCount: entities.banks.length });
        }
        if (query.includes('INSERT INTO banks')) {
            const newBank = { id: 2, name: params[1], current_balance: params[2] };
            entities.banks.push(newBank);
            return Promise.resolve({ rows: [newBank], rowCount: 1 });
        }
        if (query.includes('SELECT current_balance FROM banks WHERE id')) {
            return Promise.resolve({ rows: [{ current_balance: 5000 }], rowCount: 1 });
        }
        if (query.includes('UPDATE banks SET current_balance')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
        }

        // Credit card operations
        if (query.includes('SELECT * FROM credit_cards WHERE user_id')) {
            return Promise.resolve({ rows: entities.credit_cards, rowCount: entities.credit_cards.length });
        }
        if (query.includes('INSERT INTO credit_cards')) {
            const newCard = { id: 2, name: params[1] };
            return Promise.resolve({ rows: [newCard], rowCount: 1 });
        }

        // Cash balance operations
        if (query.includes('SELECT balance FROM cash_balance WHERE user_id')) {
            return Promise.resolve({ rows: entities.cash_balance, rowCount: 1 });
        }
        if (query.includes('INSERT INTO cash_balance') || query.includes('UPDATE cash_balance')) {
            return Promise.resolve({ rows: [{ balance: params[0] }], rowCount: 1 });
        }

        // Income operations
        if (query.includes('SELECT * FROM income_entries') || query.includes('SELECT') && query.includes('income_entries')) {
            return Promise.resolve({ rows: entities.income_entries, rowCount: entities.income_entries.length });
        }
        if (query.includes('INSERT INTO income_entries')) {
            const newIncome = { id: 2, source: params[0], amount: params[1] };
            return Promise.resolve({ rows: [newIncome], rowCount: 1 });
        }

        // Expense operations
        if (query.includes('SELECT * FROM expenses') || query.includes('SELECT') && query.includes('expenses')) {
            return Promise.resolve({ rows: entities.expenses, rowCount: entities.expenses.length });
        }
        if (query.includes('INSERT INTO expenses')) {
            const newExpense = { id: 2, title: params[0], amount: params[1] };
            return Promise.resolve({ rows: [newExpense], rowCount: 1 });
        }

        // Activity feed (lines 1540-1728 coverage target)
        if (query.includes('SELECT') && query.includes('UNION ALL')) {
            const activities = [
                { id: 1, type: 'income', description: 'Salary', amount: 3000, date: '2025-07-15' },
                { id: 2, type: 'expense', description: 'Food', amount: -100, date: '2025-07-15' }
            ];
            return Promise.resolve({ rows: activities, rowCount: activities.length });
        }

        // Monthly summary operations
        if (query.includes('SUM') && (query.includes('income_entries') || query.includes('expenses'))) {
            return Promise.resolve({ rows: [{ sum: '5000' }], rowCount: 1 });
        }

        // Update tracking option
        if (query.includes('UPDATE users SET tracking_option')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
        }

        // Default
        return Promise.resolve({ rows: [], rowCount: 0 });
    });

    return {
        Pool: jest.fn().mockImplementation(() => ({
            query: mockQuery,
            end: mockEnd
        }))
    };
});

// Import the server after mocking
const { app } = require('../server');

describe('Server Coverage Tests', () => {
    let sessionCookie;

    beforeAll(async () => {
        // Login to get session cookie
        const loginResponse = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'password123' });
        
        sessionCookie = loginResponse.headers['set-cookie'];
    });

    describe('Authentication Endpoints', () => {
        test('should register new user', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    username: 'newuser',
                    password: 'Password123!',
                    name: 'New User',
                    email: 'new@test.com',
                    securityQuestion: 'Test?',
                    securityAnswer: 'answer'
                });

            expect(response.status).toBe(200);
        });

        test('should login user', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({ username: 'testuser', password: 'password123' });

            expect(response.status).toBe(200);
        });

        test('should logout user', async () => {
            const response = await request(app)
                .post('/api/logout')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });
    });

    describe('Bank Endpoints', () => {
        test('should get banks', async () => {
            const response = await request(app)
                .get('/api/banks')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should create bank', async () => {
            const response = await request(app)
                .post('/api/banks')
                .set('Cookie', sessionCookie)
                .send({ name: 'New Bank', initialBalance: 1000 });

            expect(response.status).toBe(200);
        });
    });

    describe('Credit Card Endpoints', () => {
        test('should get credit cards', async () => {
            const response = await request(app)
                .get('/api/credit-cards')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should create credit card', async () => {
            const response = await request(app)
                .post('/api/credit-cards')
                .set('Cookie', sessionCookie)
                .send({ name: 'New Card' });

            expect(response.status).toBe(200);
        });
    });

    describe('Cash Balance Endpoints', () => {
        test('should get cash balance', async () => {
            const response = await request(app)
                .get('/api/cash-balance')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should set cash balance', async () => {
            const response = await request(app)
                .post('/api/cash-balance')
                .set('Cookie', sessionCookie)
                .send({ balance: 3000 });

            expect(response.status).toBe(200);
        });
    });

    describe('Income Endpoints', () => {
        test('should get income entries', async () => {
            const response = await request(app)
                .get('/api/income')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should create income entry', async () => {
            const response = await request(app)
                .post('/api/income')
                .set('Cookie', sessionCookie)
                .send({
                    source: 'Bonus',
                    amount: 1000,
                    target: 'cash'
                });

            expect(response.status).toBe(200);
        });
    });

    describe('Expense Endpoints', () => {
        test('should get expenses', async () => {
            const response = await request(app)
                .get('/api/expenses')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should create expense', async () => {
            const response = await request(app)
                .post('/api/expenses')
                .set('Cookie', sessionCookie)
                .send({
                    title: 'Groceries',
                    amount: 200,
                    source: 'cash'
                });

            expect(response.status).toBe(200);
        });
    });

    describe('Monthly Summary Endpoints', () => {
        test('should get monthly summary', async () => {
            const response = await request(app)
                .get('/api/monthly-summary')
                .set('Cookie', sessionCookie)
                .query({ month: 7, year: 2025 });

            expect(response.status).toBe(200);
        });
    });

    describe('Activity Feed Endpoints - Target lines 1540-1728', () => {
        test('should get user activity', async () => {
            const response = await request(app)
                .get('/api/user-activity')
                .set('Cookie', sessionCookie);

            expect(response.status).toBe(200);
        });

        test('should get user activity with filters', async () => {
            const response = await request(app)
                .get('/api/user-activity')
                .set('Cookie', sessionCookie)
                .query({
                    page: 1,
                    limit: 10,
                    type: 'income',
                    from_date: '2025-07-01',
                    to_date: '2025-07-31'
                });

            expect(response.status).toBe(200);
        });

        test('should export activity as CSV', async () => {
            const response = await request(app)
                .get('/api/user-activity')
                .set('Cookie', sessionCookie)
                .query({ export: 'true' });

            expect(response.status).toBe(200);
        });
    });

    describe('Settings Endpoints', () => {
        test('should update tracking option', async () => {
            const response = await request(app)
                .post('/api/set-tracking-option')
                .set('Cookie', sessionCookie)
                .send({ trackingOption: 'expenses' });

            expect(response.status).toBe(200);
        });
    });

    describe('Static File Serving', () => {
        test('should serve index.html', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
        });
    });
});
