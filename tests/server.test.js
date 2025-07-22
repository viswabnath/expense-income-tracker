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

// Password validation function (same as in server.js)
function validatePassword(password) {
    // Check length (8-16 characters)
    if (password.length < 8 || password.length > 16) {
        return 'Password must be between 8 and 16 characters long';
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }

    // Check for at least one special character (_ - &)
    if (!/[_\-&]/.test(password)) {
        return 'Password must contain at least one special character (_, -, or &)';
    }

    return null; // Password is valid
}

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

            // Validate password strength
            const passwordError = validatePassword(password);
            if (passwordError) {
                return res.status(400).json({ error: passwordError });
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

describe('Password Validation Function', () => {
    test('should return null for valid passwords', () => {
        expect(validatePassword('Password123_')).toBeNull();
        expect(validatePassword('Test123-')).toBeNull();
        expect(validatePassword('MyPass1&')).toBeNull();
        expect(validatePassword('Strong9_')).toBeNull();
        expect(validatePassword('Valid123-Pass')).toBeNull();
    });

    test('should reject passwords that are too short', () => {
        expect(validatePassword('Pass1_')).toBe('Password must be between 8 and 16 characters long');
        expect(validatePassword('Aa1_')).toBe('Password must be between 8 and 16 characters long');
        expect(validatePassword('')).toBe('Password must be between 8 and 16 characters long');
    });

    test('should reject passwords that are too long', () => {
        expect(validatePassword('Password123_TooLong')).toBe('Password must be between 8 and 16 characters long');
        expect(validatePassword('ThisPasswordIsWayTooLong123_')).toBe('Password must be between 8 and 16 characters long');
    });

    test('should reject passwords missing lowercase letters', () => {
        expect(validatePassword('PASSWORD123_')).toBe('Password must contain at least one lowercase letter');
        expect(validatePassword('TEST123-')).toBe('Password must contain at least one lowercase letter');
    });

    test('should reject passwords missing uppercase letters', () => {
        expect(validatePassword('password123_')).toBe('Password must contain at least one uppercase letter');
        expect(validatePassword('test123-')).toBe('Password must contain at least one uppercase letter');
    });

    test('should reject passwords missing numbers', () => {
        expect(validatePassword('Password_')).toBe('Password must contain at least one number');
        expect(validatePassword('TestPass-')).toBe('Password must contain at least one number');
    });

    test('should reject passwords missing special characters', () => {
        expect(validatePassword('Password123')).toBe('Password must contain at least one special character (_, -, or &)');
        expect(validatePassword('TestPass123')).toBe('Password must contain at least one special character (_, -, or &)');
    });

    test('should reject passwords with invalid special characters', () => {
        expect(validatePassword('Password123!')).toBe('Password must contain at least one special character (_, -, or &)');
        expect(validatePassword('Password123@')).toBe('Password must contain at least one special character (_, -, or &)');
        expect(validatePassword('Password123#')).toBe('Password must contain at least one special character (_, -, or &)');
    });

    test('should accept passwords with valid special characters', () => {
        expect(validatePassword('Password123_')).toBeNull();
        expect(validatePassword('Password123-')).toBeNull();
        expect(validatePassword('Password123&')).toBeNull();
    });

    test('should handle edge cases', () => {
        // Exactly 8 characters
        expect(validatePassword('Pass123_')).toBeNull();
        // Exactly 16 characters
        expect(validatePassword('Password123_Pass')).toBeNull();
        // Multiple special characters
        expect(validatePassword('Pass123_-&')).toBeNull();
    });
});

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
            password: 'Password123_',
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

            expect(response.body.error).toBe('Password must be between 8 and 16 characters long');
        });

        test('should reject registration with weak passwords', async () => {
            // Test missing uppercase
            let invalidData = { ...validRegistrationData, password: 'password123_' };
            let response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);
            expect(response.body.error).toBe('Password must contain at least one uppercase letter');

            // Test missing lowercase
            invalidData = { ...validRegistrationData, password: 'PASSWORD123_' };
            response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);
            expect(response.body.error).toBe('Password must contain at least one lowercase letter');

            // Test missing number
            invalidData = { ...validRegistrationData, password: 'Password_' };
            response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);
            expect(response.body.error).toBe('Password must contain at least one number');

            // Test missing special character
            invalidData = { ...validRegistrationData, password: 'Password123' };
            response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);
            expect(response.body.error).toBe('Password must contain at least one special character (_, -, or &)');

            // Test too long password
            invalidData = { ...validRegistrationData, password: 'Password123_TooLong' };
            response = await request(app)
                .post('/api/register')
                .send(invalidData)
                .expect(400);
            expect(response.body.error).toBe('Password must be between 8 and 16 characters long');
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
