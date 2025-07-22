/**
 * Authentication Manager Unit Tests
 */

// Mock the DOM environment
const mockElement = (value = '') => ({
    value,
    textContent: '',
    className: '',
    classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
    }
});

// Mock document.getElementById
global.document = {
    getElementById: jest.fn()
};

// Import the AuthManager class (we'll need to load it differently for testing)
class AuthManager {
    constructor() {
        this.resetUserId = null;
    }

    static validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static validateUsername(username) {
        return /^[a-zA-Z0-9_]+$/.test(username);
    }

    static validateInput(value, fieldName) {
        if (!value || !value.trim()) {
            throw new Error(`${fieldName} is required`);
        }
        return value.trim();
    }

    getSecurityQuestionText(questionKey) {
        const questions = {
            'pet': 'What was the name of your first pet?',
            'school': 'What was the name of your elementary school?',
            'city': 'In what city were you born?',
            'mother': 'What is your mother\'s maiden name?',
            'car': 'What was the make of your first car?',
            'street': 'What street did you grow up on?'
        };
        return questions[questionKey] || questionKey;
    }

    validateRegistrationData(data) {
        if (!AuthManager.validateEmail(data.email)) {
            throw new Error('Please enter a valid email address');
        }

        if (data.password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        if (data.password !== data.confirmPassword) {
            throw new Error('Passwords do not match');
        }

        if (!AuthManager.validateUsername(data.username)) {
            throw new Error('Username can only contain letters, numbers, and underscores');
        }

        if (data.securityAnswer.length < 2) {
            throw new Error('Security answer must be at least 2 characters long');
        }
    }
}

describe('AuthManager', () => {
    let authManager;

    beforeEach(() => {
        authManager = new AuthManager();
        jest.clearAllMocks();
    });

    describe('validateEmail', () => {
        test('should validate correct email formats', () => {
            expect(AuthManager.validateEmail('test@example.com')).toBe(true);
            expect(AuthManager.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(AuthManager.validateEmail('user123@test.org')).toBe(true);
        });

        test('should reject invalid email formats', () => {
            expect(AuthManager.validateEmail('invalid-email')).toBe(false);
            expect(AuthManager.validateEmail('@domain.com')).toBe(false);
            expect(AuthManager.validateEmail('user@')).toBe(false);
            expect(AuthManager.validateEmail('user@domain')).toBe(false);
            expect(AuthManager.validateEmail('')).toBe(false);
        });
    });

    describe('validateUsername', () => {
        test('should validate correct username formats', () => {
            expect(AuthManager.validateUsername('john_doe')).toBe(true);
            expect(AuthManager.validateUsername('user123')).toBe(true);
            expect(AuthManager.validateUsername('USERNAME')).toBe(true);
            expect(AuthManager.validateUsername('test_user_123')).toBe(true);
        });

        test('should reject invalid username formats', () => {
            expect(AuthManager.validateUsername('john-doe')).toBe(false);
            expect(AuthManager.validateUsername('user name')).toBe(false);
            expect(AuthManager.validateUsername('user@domain')).toBe(false);
            expect(AuthManager.validateUsername('user.name')).toBe(false);
            expect(AuthManager.validateUsername('user!123')).toBe(false);
            expect(AuthManager.validateUsername('')).toBe(false);
        });
    });

    describe('validateInput', () => {
        test('should validate and trim non-empty inputs', () => {
            expect(AuthManager.validateInput('  test  ', 'Test')).toBe('test');
            expect(AuthManager.validateInput('value', 'Field')).toBe('value');
        });

        test('should throw error for empty inputs', () => {
            expect(() => AuthManager.validateInput('', 'Username')).toThrow('Username is required');
            expect(() => AuthManager.validateInput('   ', 'Password')).toThrow('Password is required');
            expect(() => AuthManager.validateInput(null, 'Email')).toThrow('Email is required');
            expect(() => AuthManager.validateInput(undefined, 'Name')).toThrow('Name is required');
        });
    });

    describe('getSecurityQuestionText', () => {
        test('should return correct question text for valid keys', () => {
            expect(authManager.getSecurityQuestionText('pet')).toBe('What was the name of your first pet?');
            expect(authManager.getSecurityQuestionText('school')).toBe('What was the name of your elementary school?');
            expect(authManager.getSecurityQuestionText('city')).toBe('In what city were you born?');
        });

        test('should return the key itself for unknown keys', () => {
            expect(authManager.getSecurityQuestionText('unknown')).toBe('unknown');
            expect(authManager.getSecurityQuestionText('')).toBe('');
        });
    });

    describe('validateRegistrationData', () => {
        const validData = {
            name: 'John Doe',
            username: 'john_doe',
            email: 'john@example.com',
            password: 'password123',
            confirmPassword: 'password123',
            securityQuestion: 'pet',
            securityAnswer: 'Fluffy'
        };

        test('should pass validation for valid data', () => {
            expect(() => authManager.validateRegistrationData(validData)).not.toThrow();
        });

        test('should throw error for invalid email', () => {
            const invalidData = { ...validData, email: 'invalid-email' };
            expect(() => authManager.validateRegistrationData(invalidData))
                .toThrow('Please enter a valid email address');
        });

        test('should throw error for short password', () => {
            const invalidData = { ...validData, password: '123', confirmPassword: '123' };
            expect(() => authManager.validateRegistrationData(invalidData))
                .toThrow('Password must be at least 6 characters long');
        });

        test('should throw error for password mismatch', () => {
            const invalidData = { ...validData, confirmPassword: 'different' };
            expect(() => authManager.validateRegistrationData(invalidData))
                .toThrow('Passwords do not match');
        });

        test('should throw error for invalid username', () => {
            const invalidData = { ...validData, username: 'john-doe' };
            expect(() => authManager.validateRegistrationData(invalidData))
                .toThrow('Username can only contain letters, numbers, and underscores');
        });

        test('should throw error for short security answer', () => {
            const invalidData = { ...validData, securityAnswer: 'a' };
            expect(() => authManager.validateRegistrationData(invalidData))
                .toThrow('Security answer must be at least 2 characters long');
        });
    });
});
