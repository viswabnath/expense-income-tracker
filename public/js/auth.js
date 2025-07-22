/**
 * Authentication Module
 * Handles login, registration, and password reset functionality
 */

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

    static showError(message) {
        const errorElement = document.getElementById('auth-message');
        if (errorElement) {
            errorElement.className = 'error';
            errorElement.textContent = message;
        }
    }

    static showSuccess(message) {
        const errorElement = document.getElementById('auth-message');
        if (errorElement) {
            errorElement.className = 'success';
            errorElement.textContent = message;
        }
    }

    static clearMessage() {
        const errorElement = document.getElementById('auth-message');
        if (errorElement) {
            errorElement.textContent = '';
        }
    }

    async login() {
        try {
            const username = AuthManager.validateInput(
                document.getElementById('login-username').value, 
                'Username'
            );
            const password = AuthManager.validateInput(
                document.getElementById('login-password').value, 
                'Password'
            );

            if (!AuthManager.validateUsername(username)) {
                throw new Error('Invalid username format. Username can only contain letters, numbers, and underscores');
            }

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                window.expenseTracker.currentUser = data;
                window.expenseTracker.trackingOption = data.trackingOption;
                document.getElementById('user-name').textContent = data.name;
                this.hideAuthSection();
                this.showMainApp();
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            AuthManager.showError(error.message || 'Login failed');
        }
    }

    async register() {
        try {
            const formData = this.getRegistrationData();
            this.validateRegistrationData(formData);

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                window.expenseTracker.currentUser = { name: formData.name, userId: data.userId };
                document.getElementById('user-name').textContent = formData.name;
                this.hideAuthSection();
                this.showWelcomeSection();
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            AuthManager.showError(error.message || 'Registration failed');
        }
    }

    getRegistrationData() {
        return {
            name: AuthManager.validateInput(document.getElementById('register-name').value, 'Name'),
            username: AuthManager.validateInput(document.getElementById('register-username').value, 'Username'),
            email: AuthManager.validateInput(document.getElementById('register-email').value, 'Email'),
            password: AuthManager.validateInput(document.getElementById('register-password').value, 'Password'),
            confirmPassword: AuthManager.validateInput(document.getElementById('register-confirm-password').value, 'Confirm Password'),
            securityQuestion: AuthManager.validateInput(document.getElementById('register-security-question').value, 'Security Question'),
            securityAnswer: AuthManager.validateInput(document.getElementById('register-security-answer').value, 'Security Answer')
        };
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

    async requestPasswordReset() {
        try {
            const input = AuthManager.validateInput(
                document.getElementById('forgot-username-email').value,
                'Username or Email'
            );

            const isEmail = AuthManager.validateEmail(input);
            const isValidUsername = AuthManager.validateUsername(input);

            if (!isEmail && !isValidUsername) {
                throw new Error('Please enter a valid username (letters, numbers, underscore only) or a valid email address');
            }

            const payload = isEmail ? { email: input } : { username: input };

            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                this.resetUserId = data.userId;
                document.getElementById('reset-user-name').textContent = data.name;
                document.getElementById('reset-security-question').textContent = 
                    this.getSecurityQuestionText(data.securityQuestion);
                this.showForm('reset-password-form');
                AuthManager.clearMessage();
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            AuthManager.showError(error.message || 'Error occurred. Please try again.');
        }
    }

    async resetPassword() {
        try {
            const securityAnswer = AuthManager.validateInput(
                document.getElementById('reset-security-answer').value,
                'Security Answer'
            );
            const newPassword = AuthManager.validateInput(
                document.getElementById('reset-new-password').value,
                'New Password'
            );
            const confirmPassword = AuthManager.validateInput(
                document.getElementById('reset-confirm-password').value,
                'Confirm Password'
            );

            if (newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            if (newPassword !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.resetUserId,
                    securityAnswer,
                    newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                AuthManager.showSuccess('Password reset successfully! You can now login with your new password.');
                this.clearResetForm();
                setTimeout(() => this.showLoginForm(), 2000);
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            AuthManager.showError(error.message || 'Error occurred. Please try again.');
        }
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

    clearResetForm() {
        document.getElementById('reset-security-answer').value = '';
        document.getElementById('reset-new-password').value = '';
        document.getElementById('reset-confirm-password').value = '';
        document.getElementById('forgot-username-email').value = '';
        this.resetUserId = null;
    }

    showLoginForm() {
        this.showForm('login-form');
    }

    showRegisterForm() {
        this.showForm('register-form');
    }

    showForgotPasswordForm() {
        this.showForm('forgot-password-form');
    }

    showForm(formId) {
        const forms = ['login-form', 'register-form', 'forgot-password-form', 'reset-password-form'];
        forms.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('hidden', id !== formId);
            }
        });
        AuthManager.clearMessage();
    }

    hideAuthSection() {
        const authSection = document.getElementById('auth-section');
        if (authSection) authSection.classList.add('hidden');
    }

    showWelcomeSection() {
        const welcomeSection = document.getElementById('welcome-section');
        if (welcomeSection) welcomeSection.classList.remove('hidden');
    }

    showMainApp() {
        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.classList.remove('hidden');
            window.navigationManager.showSection('setup');
            window.setupManager.loadSetupData();
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.expenseTracker.currentUser = null;
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('auth-section').classList.remove('hidden');
            this.showLoginForm();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// Global auth manager instance
window.authManager = new AuthManager();
