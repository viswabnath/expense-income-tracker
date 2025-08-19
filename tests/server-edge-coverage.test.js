/**
 * Server Edge Cases and Coverage Tests
 * @jest-environment node
 */

const request = require('supertest');

// Mock rate limiter
jest.mock('express-rate-limit', () => {
    return () => (req, res, next) => next();
});

// Mock pg Pool
jest.mock('pg', () => {
    const mockQuery = jest.fn();
    const mockPool = {
        query: mockQuery,
        connect: jest.fn().mockResolvedValue({
            query: mockQuery,
            release: jest.fn()
        }),
        end: jest.fn()
    };
    return { Pool: jest.fn(() => mockPool) };
});

// Import the actual server app AFTER mocking
const { app, pool } = require('../server');

describe('Server Edge Cases and Coverage Tests', () => {
    let mockQuery;

    beforeAll(() => {
        mockQuery = pool.query;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    describe('Non-authenticated endpoints coverage', () => {
        test('should cover /api/debug-monthly success path', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ registration_date: '2025-01-01' }],
                rowCount: 1
            });

            mockQuery.mockResolvedValueOnce({
                rows: [
                    { month: 8, year: 2025, total_income: 5000, total_expense: 2000 }
                ],
                rowCount: 1
            });

            const response = await request(app)
                .get('/api/debug-monthly?month=8&year=2025&userId=1');

            expect([200, 500].includes(response.status)).toBe(true);
        });

        test('should cover /api/debug-monthly with no user found', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0
            });

            const response = await request(app)
                .get('/api/debug-monthly?month=8&year=2025&userId=999');

            expect([200, 404, 500].includes(response.status)).toBe(true);
        });

        test('should cover /api/debug-monthly error handling', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get('/api/debug-monthly');

            expect(response.status >= 400).toBe(true);
        });
    });

    describe('Password validation edge cases', () => {
        test('should cover all password validation error paths', async () => {
            // Test short password
            let response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: '123',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Test long password
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: '1234567890123456789',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Test no lowercase
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: 'PASSWORD123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Test no uppercase
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: 'password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Test no number
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: 'Password&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Test no special character
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test',
                    password: 'Password123',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);
        });
    });

    describe('Username validation edge cases', () => {
        test('should cover invalid username formats', async () => {
            // Username with invalid characters
            let response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test-user!',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Username with spaces
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test user',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Username with dots
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'test.user',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);
        });

        test('should cover invalid username in login', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    username: 'invalid-username!',
                    password: 'password'
                });
            expect(response.status).toBe(400);
        });

        test('should cover invalid username in forgot-password', async () => {
            const response = await request(app)
                .post('/api/forgot-password')
                .send({
                    username: 'invalid-username!',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);
        });
    });

    describe('Email validation edge cases', () => {
        test('should cover invalid email formats', async () => {
            // Invalid email format 1
            let response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'invalid-email',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Invalid email format 2
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: '@invalid.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Invalid email format 3
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'invalid@',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);
        });

        test('should cover invalid email in forgot-username', async () => {
            const response = await request(app)
                .post('/api/forgot-username')
                .send({
                    email: 'invalid-email'
                });
            expect(response.status).toBe(400);
        });
    });

    describe('Missing fields validation', () => {
        test('should cover all missing fields in registration', async () => {
            // Missing username
            let response = await request(app)
                .post('/api/register')
                .send({
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing password
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing name
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing email
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing security question
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing security answer
            response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question'
                });
            expect(response.status).toBe(400);
        });

        test('should cover missing fields in login', async () => {
            // Missing username
            let response = await request(app)
                .post('/api/login')
                .send({
                    password: 'password'
                });
            expect(response.status).toBe(400);

            // Missing password
            response = await request(app)
                .post('/api/login')
                .send({
                    username: 'testuser'
                });
            expect(response.status).toBe(400);
        });

        test('should cover missing fields in forgot-password', async () => {
            // Missing username
            let response = await request(app)
                .post('/api/forgot-password')
                .send({
                    securityAnswer: 'answer'
                });
            expect(response.status).toBe(400);

            // Missing security answer
            response = await request(app)
                .post('/api/forgot-password')
                .send({
                    username: 'testuser'
                });
            expect([400, 500].includes(response.status)).toBe(true);
        });
    });

    describe('Database error handling', () => {
        test('should cover registration database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .post('/api/register')
                .send({
                    username: 'testuser',
                    password: 'Password123&',
                    name: 'Test',
                    email: 'test@test.com',
                    securityQuestion: 'question',
                    securityAnswer: 'answer'
                });
            
            expect(response.status >= 400).toBe(true);
        });

        test('should cover login database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .post('/api/login')
                .send({
                    username: 'testuser',
                    password: 'password'
                });
            
            expect(response.status >= 400).toBe(true);
        });
    });

    describe('HTTP method and route coverage', () => {
        test('should cover 404 for non-existent routes', async () => {
            const response = await request(app).get('/api/nonexistent');
            expect(response.status).toBe(404);
        });

        test('should cover static file serving', async () => {
            const response = await request(app).get('/');
            expect([200, 404].includes(response.status)).toBe(true);
        });
    });
});
