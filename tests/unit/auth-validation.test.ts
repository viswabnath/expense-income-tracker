/**
 * Unit tests for lib/auth-validation.ts: same rules and messages as the legacy forms and the server
 */
import {
    isValidEmail, isValidUsername, passwordProblem, requireValue, securityQuestionText, validateRegistration,
    type RegistrationInput,
} from '../../lib/auth-validation';

const valid: RegistrationInput = {
    name: 'Asha Rao',
    username: 'asha_rao',
    email: 'asha@example.com',
    password: 'Balance_2026',
    confirmPassword: 'Balance_2026',
    securityQuestion: 'pet',
    securityAnswer: 'rex',
};

describe('passwordProblem', () => {
    test.each([
        ['Ab1_', 'Password must be between 8 and 16 characters long'],
        ['Abcdefgh1_Abcdefgh', 'Password must be between 8 and 16 characters long'],
        ['ABCDEFG1_', 'Password must contain at least one lowercase letter'],
        ['abcdefg1_', 'Password must contain at least one uppercase letter'],
        ['Abcdefgh_', 'Password must contain at least one number'],
        ['Abcdefgh1!', 'Password must contain at least one special character (_, -, @, :,or &)'],
    ])('%s -> %s', (password, message) => {
        expect(passwordProblem(password)).toBe(message);
    });

    test.each(['Balance_2026', 'Abcdefg1-', 'Abcdefg1@', 'Abcdefg1:', 'Abcdefg1&'])('%s is accepted', password => {
        expect(passwordProblem(password)).toBeNull();
    });
});

describe('field checks', () => {
    test('username allows letters, numbers and underscores only', () => {
        expect(isValidUsername('asha_rao2')).toBe(true);
        expect(isValidUsername('asha.rao')).toBe(false);
        expect(isValidUsername('asha rao')).toBe(false);
    });

    test('email needs a local part, @ and a dotted domain', () => {
        expect(isValidEmail('a@b.co')).toBe(true);
        expect(isValidEmail('a@b')).toBe(false);
        expect(isValidEmail('a b@c.d')).toBe(false);
    });

    test('requireValue trims and names the empty field', () => {
        expect(requireValue('  x  ', 'Name')).toBe('x');
        expect(() => requireValue('   ', 'Name')).toThrow('Name is required');
    });

    test('security question keys map to their text, unknown keys pass through', () => {
        expect(securityQuestionText('city')).toBe('In what city were you born?');
        expect(securityQuestionText('custom question?')).toBe('custom question?');
    });
});

describe('validateRegistration', () => {
    test('returns trimmed values for a valid form', () => {
        expect(validateRegistration({ ...valid, name: '  Asha Rao ' }).name).toBe('Asha Rao');
    });

    test.each<[Partial<RegistrationInput>, string]>([
        [{ name: '' }, 'Name is required'],
        [{ email: 'not-an-email' }, 'Please enter a valid email address'],
        [{ password: 'weak', confirmPassword: 'weak' }, 'Password must be between 8 and 16 characters long'],
        [{ confirmPassword: 'Balance_2027' }, 'Passwords do not match'],
        [{ username: 'asha.rao' }, 'Username can only contain letters, numbers, and underscores'],
        [{ securityAnswer: 'x' }, 'Security answer must be at least 2 characters long'],
    ])('rejects %p with "%s"', (change, message) => {
        expect(() => validateRegistration({ ...valid, ...change })).toThrow(message);
    });
});
