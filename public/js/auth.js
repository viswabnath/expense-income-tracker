/**
 * Authentication Module
 * Handles login, registration, and password reset functionality
 */

class AuthManager {
    constructor() {
        this.resetUserId = null;
        this.apiClient = window.apiClient;
    }

    async checkAuthentication() {
        try {
            const response = await this.apiClient.get('/api/user');
            // If successful, user is authenticated
            return {
                isAuthenticated: true,
                user: response
            };
        } catch (error) {
            // If it fails with 401, user is not authenticated
            if (error.message.includes('Authentication required') || error.message.includes('401')) {
                return {
                    isAuthenticated: false,
                    error: error.message
                };
            }
            // For other errors, still consider not authenticated but log the error
            console.error('Authentication check error:', error);
            return {
                isAuthenticated: false,
                error: error.message
            };
        }
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

        // Check for at least one special character (_ - &@)
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
                window.expenseTracker.isAuthenticated = true;
                document.getElementById('user-name').textContent = data.name;
                this.hideAuthSection();
                window.expenseTracker.showMainApplication();
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            console.error('Login error:', error);
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
                window.expenseTracker.isAuthenticated = true;
                window.expenseTracker.trackingOption = 'none'; // Force welcome section
                document.getElementById('user-name').textContent = formData.name;
                this.hideAuthSection();
                window.authManager.showWelcomeSection();
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            console.error('Registration error:', error);
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
            console.error('Request password reset error:', error);
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

            // Validate new password strength
            const passwordError = AuthManager.validatePassword(newPassword);
            if (passwordError) {
                throw new Error(passwordError);
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
            console.error('Reset password error:', error);
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
        const forms = [
            'login-form',
            'register-form',
            'forgot-password-form',
            'reset-password-form',
            'forgot-username-form'
        ];
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

    // Forgot Username functionality
    async forgotUsername() {
        try {
            const emailInput = document.getElementById('forgot-username-email-input');

            if (!emailInput) {
                throw new Error('Email input field not found');
            }

            const email = AuthManager.validateInput(
                emailInput.value,
                'Email'
            );

            if (!AuthManager.validateEmail(email)) {
                throw new Error('Please enter a valid email address');
            }

            const response = await fetch('/api/forgot-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'credentials': 'include'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                AuthManager.showSuccess(`Username found: ${data.username} (${data.name})`);
                // Optionally switch to login form and pre-fill username
                setTimeout(() => {
                    this.showForm('login-form');
                    document.getElementById('login-username').value = data.username;
                }, 2000);
            } else {
                AuthManager.showError(data.error);
            }
        } catch (error) {
            console.error('Forgot username error:', error);
            AuthManager.showError(error.message || 'Failed to retrieve username');
        }
    }

    showForgotUsernameForm() {
        this.showForm('forgot-username-form');
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            // Clear local state regardless of server response
            window.expenseTracker.isAuthenticated = false;
            window.expenseTracker.currentUser = null;
            window.expenseTracker.trackingOption = 'both';

            // Show authentication forms
            window.expenseTracker.showAuthenticationForms();

            // Clear any cached data
            this.clearCachedData();

        } catch (error) {
            // Still clear local state even if logout request fails
            console.error('Logout error:', error);
            window.expenseTracker.isAuthenticated = false;
            window.expenseTracker.showAuthenticationForms();
        }
    }

    clearCachedData() {
        // Clear any cached data in the UI
        const summaryDisplay = document.getElementById('summary-display');
        if (summaryDisplay) {
            summaryDisplay.innerHTML = '';
        }

        // Clear transaction tables
        const incomeTableBody = document.getElementById('income-table-body');
        if (incomeTableBody) {
            incomeTableBody.innerHTML = '';
        }

        const expenseTableBody = document.getElementById('expense-table-body');
        if (expenseTableBody) {
            expenseTableBody.innerHTML = '';
        }
    }
}

// Global auth manager instance
window.authManager = new AuthManager();

// Global functions for HTML onclick handlers


const expenseTableBody = document.getElementById('expense-table-body');
if (expenseTableBody) {
    expenseTableBody.innerHTML = '';
}



// Global auth manager instance
window.authManager = new AuthManager();

// Global functions for HTML onclick handlers
