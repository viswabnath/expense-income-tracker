/**
 * Server API Endpoints Unit Tests
 * @jest-environment node
 */

const request = require('supertest');
const express = require('express');

// Mock bcrypt
const bcrypt = {
    hash: jest.fn().mockResolvedValue('hashedPassword'),
    compare: jest.fn().mockResolvedValue(true)
};

// Mock database
const mockPool = {
    query: jest.fn()
};

// Create a test app with just the authentication routes
const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Mock session middleware
    app.use((req, res, next) => {
        req.session = {
            userId: null,
            save: jest.fn(cb => cb()),
            destroy: jest.fn(cb => cb())
        };
        next();
    });

    // Register endpoint
    app.post('/api/register', async (req, res) => {
        try {
            const { username, password, name, email, securityQuestion, securityAnswer } = req.body;

            // Server-side validation
            if (!username || !password || !name || !email || !securityQuestion || !securityAnswer) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Validate password length
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            // Validate username format
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
            }

            // Mock successful registration
            mockPool.query.mockResolvedValueOnce({ rows: [] }); // No existing user
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert result

            bcrypt.hash.mockResolvedValueOnce('hashedPassword');
            bcrypt.hash.mockResolvedValueOnce('hashedSecurityAnswer');

            res.json({ success: true, userId: 1 });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Login endpoint
    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({ error: 'Invalid username format. Username can only contain letters, numbers, and underscores' });
            }

            // Mock user lookup
            const mockUser = {
                id: 1,
                password_hash: 'hashedPassword',
                name: 'Test User',
                tracking_option: 'both'
            };

            mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
            bcrypt.compare.mockResolvedValueOnce(true);

            res.json({
                success: true,
                userId: mockUser.id,
                name: mockUser.name,
                trackingOption: mockUser.tracking_option
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return app;
};

describe('Server API Endpoints', () => {
    let app;

    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    describe('POST /api/register', () => {
        const validRegistrationData = {
            name: 'Test User',
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            securityQuestion: 'pet',
            securityAnswer: 'Fluffy'
        };

        test('should register user successfully with valid data', async () => {
            const response = await request(app)
                .post('/api/register')
                .send(validRegistrationData)
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                userId: 1
            });
        });

        test('should reject registration with missing fields', async () => {
            const invalidData = { ...validRegistrationData };
            delete invalidData.email;

            const response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBe('All fields are required');
        });

        test('should reject registration with invalid email', async () => {
            const invalidData = { ...validRegistrationData, email: 'invalid-email' };

            const response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBe('Invalid email format');
        });

        test('should reject registration with short password', async () => {
            const invalidData = { ...validRegistrationData, password: '123' };

            const response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBe('Password must be at least 6 characters long');
        });

        test('should reject registration with invalid username', async () => {
            const invalidData = { ...validRegistrationData, username: 'test-user' };

            const response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBe('Username can only contain letters, numbers, and underscores');
        });
    });

    describe('POST /api/login', () => {
        test('should login successfully with valid credentials', async () => {
            const credentials = {
                username: 'testuser',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/login')
                .send(credentials)
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                userId: 1,
                name: 'Test User',
                trackingOption: 'both'
            });
        });

        test('should reject login with missing credentials', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({ username: 'testuser' })
                .expect(400);

            expect(response.body.error).toBe('Username and password are required');
        });

        test('should reject login with invalid username format', async () => {
            const credentials = {
                username: 'test-user',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/login')
                .send(credentials)
                .expect(400);

            expect(response.body.error).toBe('Invalid username format. Username can only contain letters, numbers, and underscores');
        });
    });
});
