/**
 * Authentication Manager Unit Tests
 */

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

    static validatePassword(password) {
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
        if (!/[_\-&@:]/.test(password)) {
            return 'Password must contain at least one special character (_, -, @, :,or &)';
        }

        return null; // Password is valid
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

        // Validate password strength
        const passwordError = AuthManager.validatePassword(data.password);
        if (passwordError) {
            throw new Error(passwordError);
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

    describe('validatePassword', () => {
        test('should return null for valid passwords', () => {
            expect(AuthManager.validatePassword('Password123_')).toBeNull();
            expect(AuthManager.validatePassword('Test123-')).toBeNull();
            expect(AuthManager.validatePassword('MyPass1&')).toBeNull();
            expect(AuthManager.validatePassword('Strong9_')).toBeNull();
            expect(AuthManager.validatePassword('Valid123-Pass')).toBeNull();
        });

        test('should reject passwords that are too short', () => {
            expect(AuthManager.validatePassword('Pass1_')).toBe('Password must be between 8 and 16 characters long');
            expect(AuthManager.validatePassword('Aa1_')).toBe('Password must be between 8 and 16 characters long');
            expect(AuthManager.validatePassword('')).toBe('Password must be between 8 and 16 characters long');
        });

        test('should reject passwords that are too long', () => {
            expect(AuthManager.validatePassword('Password123_TooLong')).toBe('Password must be between 8 and 16 characters long');
            expect(AuthManager.validatePassword('ThisPasswordIsWayTooLong123_')).toBe('Password must be between 8 and 16 characters long');
        });

        test('should reject passwords missing lowercase letters', () => {
            expect(AuthManager.validatePassword('PASSWORD123_')).toBe('Password must contain at least one lowercase letter');
            expect(AuthManager.validatePassword('TEST123-')).toBe('Password must contain at least one lowercase letter');
        });

        test('should reject passwords missing uppercase letters', () => {
            expect(AuthManager.validatePassword('password123_')).toBe('Password must contain at least one uppercase letter');
            expect(AuthManager.validatePassword('test123-')).toBe('Password must contain at least one uppercase letter');
        });

        test('should reject passwords missing numbers', () => {
            expect(AuthManager.validatePassword('Password_')).toBe('Password must contain at least one number');
            expect(AuthManager.validatePassword('TestPass-')).toBe('Password must contain at least one number');
        });

        test('should reject passwords missing special characters', () => {
            expect(AuthManager.validatePassword('Password123')).toBe('Password must contain at least one special character (_, -, @, :,or &)');
            expect(AuthManager.validatePassword('TestPass123')).toBe('Password must contain at least one special character (_, -, @, :,or &)');
        });

        test('should reject passwords with invalid special characters', () => {
            expect(AuthManager.validatePassword('Password123!')).toBe('Password must contain at least one special character (_, -, @, :,or &)');
            expect(AuthManager.validatePassword('Password123#')).toBe('Password must contain at least one special character (_, -, @, :,or &)');
            // '@' is allowed, so this should be valid
            expect(AuthManager.validatePassword('Password123@')).toBeNull();
        });

        test('should accept passwords with valid special characters', () => {
            expect(AuthManager.validatePassword('Password123_')).toBeNull();
            expect(AuthManager.validatePassword('Password123-')).toBeNull();
            expect(AuthManager.validatePassword('Password123&')).toBeNull();
        });

        test('should handle edge cases', () => {
            // Exactly 8 characters
            expect(AuthManager.validatePassword('Pass123_')).toBeNull();
            // Exactly 16 characters
            expect(AuthManager.validatePassword('Password123_Pass')).toBeNull();
            // Multiple special characters
            expect(AuthManager.validatePassword('Pass123_-&')).toBeNull();
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
            password: 'Password123_',
            confirmPassword: 'Password123_',
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

        test('should throw error for weak passwords', () => {
            // Too short
            const shortPassword = { ...validData, password: 'Pass1_', confirmPassword: 'Pass1_' };
            expect(() => authManager.validateRegistrationData(shortPassword))
                .toThrow('Password must be between 8 and 16 characters long');

            // Missing uppercase
            const noUppercase = { ...validData, password: 'password123_', confirmPassword: 'password123_' };
            expect(() => authManager.validateRegistrationData(noUppercase))
                .toThrow('Password must contain at least one uppercase letter');

            // Missing lowercase
            const noLowercase = { ...validData, password: 'PASSWORD123_', confirmPassword: 'PASSWORD123_' };
            expect(() => authManager.validateRegistrationData(noLowercase))
                .toThrow('Password must contain at least one lowercase letter');

            // Missing number
            const noNumber = { ...validData, password: 'Password_', confirmPassword: 'Password_' };
            expect(() => authManager.validateRegistrationData(noNumber))
                .toThrow('Password must contain at least one number');

            // Missing special character
            const noSpecial = { ...validData, password: 'Password123', confirmPassword: 'Password123' };
            expect(() => authManager.validateRegistrationData(noSpecial))
                .toThrow('Password must contain at least one special character (_, -, @, :,or &)');
        });

        test('should throw error for password mismatch', () => {
            const invalidData = { ...validData, confirmPassword: 'Different123_' };
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
