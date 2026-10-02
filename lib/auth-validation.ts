/**
 * Client-side checks for the auth forms. Same rules and messages as the legacy
 * single-page app's AuthManager and the server's validatePassword, so users see
 * identical behaviour. The server validates again; these only give faster feedback.
 */

export const SECURITY_QUESTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'pet', label: 'What was the name of your first pet?' },
    { value: 'school', label: 'What was the name of your elementary school?' },
    { value: 'city', label: 'In what city were you born?' },
    { value: 'mother', label: 'What is your mother\'s maiden name?' },
    { value: 'car', label: 'What was the make of your first car?' },
    { value: 'street', label: 'What street did you grow up on?' },
];

/** The question text for a stored key; unknown keys are shown as-is (like the legacy app) */
export function securityQuestionText(key: string): string {
    return SECURITY_QUESTIONS.find(question => question.value === key)?.label ?? key;
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(username);
}

/** Returns the first problem with the password, or null if it is acceptable */
export function passwordProblem(password: string): string | null {
    if (password.length < 8 || password.length > 16) {
        return 'Password must be between 8 and 16 characters long';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }
    if (!/[_\-&@:]/.test(password)) {
        return 'Password must contain at least one special character (_, -, @, :,or &)';
    }
    return null;
}

/** Trimmed value, or an error naming the field when it is empty */
export function requireValue(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }
    return trimmed;
}

export interface RegistrationInput {
    name: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    securityQuestion: string;
    securityAnswer: string;
}

/** Validates in the same order as the legacy form; throws the first problem found */
export function validateRegistration(raw: RegistrationInput): RegistrationInput {
    const data: RegistrationInput = {
        name: requireValue(raw.name, 'Name'),
        username: requireValue(raw.username, 'Username'),
        email: requireValue(raw.email, 'Email'),
        password: requireValue(raw.password, 'Password'),
        confirmPassword: requireValue(raw.confirmPassword, 'Confirm Password'),
        securityQuestion: requireValue(raw.securityQuestion, 'Security Question'),
        securityAnswer: requireValue(raw.securityAnswer, 'Security Answer'),
    };
    if (!isValidEmail(data.email)) {
        throw new Error('Please enter a valid email address');
    }
    const problem = passwordProblem(data.password);
    if (problem) {
        throw new Error(problem);
    }
    if (data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match');
    }
    if (!isValidUsername(data.username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
    }
    if (data.securityAnswer.length < 2) {
        throw new Error('Security answer must be at least 2 characters long');
    }
    return data;
}
