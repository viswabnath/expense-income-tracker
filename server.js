// Add this to the top of both server.js and setup-db.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Rate limiting for authentication endpoints
// DEVELOPMENT: Rate limiting disabled for easier development
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Development bypass - no rate limiting
// const authLimiter = (req, res, next) => next();

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: { error: 'Too many requests. Please slow down.' }
});

// Middleware
app.use(generalLimiter);
app.use(bodyParser.json({ limit: '10mb' })); // Limit request size
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Don't use default session name
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict' // CSRF protection
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Password validation function
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

    // Check for at least one special character (_ - & @ :)
    if (!/[_\-&@:]/.test(password)) {
        return 'Password must contain at least one special character (_, -, @, :,or &)';
    }

    return null; // Password is valid
}

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

// Routes

// User Registration
app.post('/api/register', authLimiter, async (req, res) => {
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

        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedSecurityAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

        const result = await pool.query(
            'INSERT INTO users (username, password_hash, name, email, security_question, security_answer_hash, tracking_option) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [username, hashedPassword, name, email, securityQuestion, hashedSecurityAnswer, 'both']
        );

        req.session.userId = result.rows[0].id;
        res.json({ success: true, userId: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'Username or email already exists' });
        } else {
            res.status(500).json({ error: 'Registration failed. Please try again.' });
        }
    }
});

// User Login
app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Server-side validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'Invalid username format. Username can only contain letters, numbers, and underscores' });
        }

        const result = await pool.query(
            'SELECT id, password_hash, name, tracking_option FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        res.json({
            success: true,
            userId: user.id,
            name: user.name,
            trackingOption: user.tracking_option
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set tracking option
app.post('/api/set-tracking-option', requireAuth, async (req, res) => {
    try {
        const { trackingOption } = req.body;
        await pool.query(
            'UPDATE users SET tracking_option = $1 WHERE id = $2',
            [trackingOption, req.session.userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user info
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT name, tracking_option FROM users WHERE id = $1',
            [req.session.userId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot Username - Retrieve username by email
app.post('/api/forgot-username', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const result = await pool.query(
            'SELECT username, name FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this email address' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            username: user.username,
            name: user.name,
            message: 'Username found successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Password Reset - Step 1: Verify user and security question
app.post('/api/forgot-password', authLimiter, async (req, res) => {
    try {
        const { username, email } = req.body;

        if (!username && !email) {
            return res.status(400).json({ error: 'Username or email is required' });
        }

        // Validate email format if email is provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }

        // Validate username format if username is provided
        if (username) {
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({ error: 'Invalid username format. Username can only contain letters, numbers, and underscores' });
            }
        }

        let query, params;
        if (email) {
            query = 'SELECT id, username, name, security_question FROM users WHERE email = $1';
            params = [email];
        } else {
            query = 'SELECT id, username, name, security_question FROM users WHERE username = $1';
            params = [username];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            userId: user.id,
            username: user.username,
            name: user.name,
            securityQuestion: user.security_question
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Password Reset - Step 2: Reset password with security answer
app.post('/api/reset-password', authLimiter, async (req, res) => {
    try {
        const { userId, securityAnswer, newPassword } = req.body;

        if (!userId || !securityAnswer || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate new password strength
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        // Get user's security answer hash
        const result = await pool.query(
            'SELECT security_answer_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const isValidAnswer = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer_hash);

        if (!isValidAnswer) {
            return res.status(400).json({ error: 'Incorrect security answer' });
        }

        // Update password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedNewPassword, userId]
        );

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Bank operations
app.post('/api/banks', requireAuth, async (req, res) => {
    try {
        const { name, initialBalance } = req.body;
        const upperName = name.toUpperCase();

        const result = await pool.query(
            'INSERT INTO banks (user_id, name, initial_balance, current_balance) VALUES ($1, $2, $3, $3) RETURNING *',
            [req.session.userId, upperName, initialBalance || 0]
        );

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Bank already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/banks', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM banks WHERE user_id = $1 ORDER BY name',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Credit card operations
app.post('/api/credit-cards', requireAuth, async (req, res) => {
    try {
        const { name, creditLimit } = req.body;
        const upperName = name.toUpperCase();

        const result = await pool.query(
            'INSERT INTO credit_cards (user_id, name, credit_limit) VALUES ($1, $2, $3) RETURNING *',
            [req.session.userId, upperName, creditLimit]
        );

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Credit card already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/credit-cards', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY name',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cash balance operations
app.post('/api/cash-balance', requireAuth, async (req, res) => {
    try {
        const { balance } = req.body;

        // Check if user already has a cash balance record
        const existingCash = await pool.query(
            'SELECT * FROM cash_balance WHERE user_id = $1',
            [req.session.userId]
        );

        let result;
        if (existingCash.rows.length > 0) {
            // Update existing record - only update balance, keep initial_balance unchanged
            result = await pool.query(
                'UPDATE cash_balance SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *',
                [balance || 0, req.session.userId]
            );
        } else {
            // Insert new record - set both balance and initial_balance to the same value
            result = await pool.query(
                'INSERT INTO cash_balance (user_id, balance, initial_balance) VALUES ($1, $2, $2) RETURNING *',
                [req.session.userId, balance || 0]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cash-balance', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM cash_balance WHERE user_id = $1',
            [req.session.userId]
        );
        res.json(result.rows[0] || { balance: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Income operations
app.post('/api/income', requireAuth, async (req, res) => {
    try {
        const { source, amount, creditedToType, creditedToId, date } = req.body;
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        const result = await pool.query(
            'INSERT INTO income_entries (user_id, source, amount, credited_to_type, credited_to_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [req.session.userId, source, amount, creditedToType, creditedToId, date, month, year]
        );

        // Update balance
        if (creditedToType === 'bank') {
            await pool.query(
                'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                [amount, creditedToId, req.session.userId]
            );
        } else if (creditedToType === 'cash') {
            await pool.query(
                'UPDATE cash_balance SET balance = balance + $1 WHERE user_id = $2',
                [amount, req.session.userId]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/income', requireAuth, async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = 'SELECT * FROM income_entries WHERE user_id = $1';
        const params = [req.session.userId];

        if (month && year) {
            query += ' AND month = $2 AND year = $3';
            params.push(month, year);
        }

        query += ' ORDER BY date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Expense operations
app.post('/api/expenses', requireAuth, async (req, res) => {
    try {
        const { title, amount, paymentMethod, paymentSourceId, date } = req.body;
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        // Get user's tracking option to determine validation behavior
        const userResult = await pool.query(
            'SELECT tracking_option FROM users WHERE id = $1',
            [req.session.userId]
        );

        const trackingOption = userResult.rows[0]?.tracking_option || 'both';

        // For expense-only users, allow expense tracking without strict balance validation
        // For 'both' or 'income' users, enforce balance validation
        const shouldValidateBalance = trackingOption !== 'expenses';

        if (shouldValidateBalance) {
            // Validate balance/limit only for users who also track income
            if (paymentMethod === 'bank') {
                const bankResult = await pool.query(
                    'SELECT current_balance FROM banks WHERE id = $1 AND user_id = $2',
                    [paymentSourceId, req.session.userId]
                );

                if (bankResult.rows.length === 0 || bankResult.rows[0].current_balance < amount) {
                    return res.status(400).json({ error: 'Insufficient bank balance' });
                }
            } else if (paymentMethod === 'cash') {
                const cashResult = await pool.query(
                    'SELECT balance FROM cash_balance WHERE user_id = $1',
                    [req.session.userId]
                );

                if (cashResult.rows.length === 0 || cashResult.rows[0].balance < amount) {
                    return res.status(400).json({ error: 'Insufficient cash balance' });
                }
            } else if (paymentMethod === 'credit_card') {
                const ccResult = await pool.query(
                    'SELECT credit_limit, used_limit FROM credit_cards WHERE id = $1 AND user_id = $2',
                    [paymentSourceId, req.session.userId]
                );

                if (ccResult.rows.length === 0 || (ccResult.rows[0].credit_limit - ccResult.rows[0].used_limit) < amount) {
                    return res.status(400).json({ error: 'Insufficient credit limit' });
                }
            }
        }

        const result = await pool.query(
            'INSERT INTO expenses (user_id, title, amount, payment_method, payment_source_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [req.session.userId, title, amount, paymentMethod, paymentSourceId, date, month, year]
        );

        // Update balance/limit only for users who track both income and expenses
        if (shouldValidateBalance) {
            if (paymentMethod === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET balance = balance - $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            } else if (paymentMethod === 'credit_card') {
                await pool.query(
                    'UPDATE credit_cards SET used_limit = used_limit + $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            }
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/expenses', requireAuth, async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = 'SELECT * FROM expenses WHERE user_id = $1';
        const params = [req.session.userId];

        if (month && year) {
            query += ' AND month = $2 AND year = $3';
            params.push(month, year);
        }

        query += ' ORDER BY date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Monthly summary
app.get('/api/monthly-summary', requireAuth, async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.session.userId;

        // Validate month and year
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const selectedMonth = parseInt(month);
        const selectedYear = parseInt(year);
        const currentDate = new Date();
        const selectedDate = new Date(selectedYear, selectedMonth - 1, 1);

        // Check if the selected month is completed
        const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
        const currentYear = currentDate.getFullYear();
        const isCurrentMonth = (selectedMonth === currentMonth && selectedYear === currentYear);
        const isMonthCompleted = selectedYear < currentYear ||
                               (selectedYear === currentYear && selectedMonth < currentMonth);

        // Check if selected date is in the future
        if (selectedDate > currentDate) {
            return res.json({
                monthlyIncome: 0,
                totalCurrentWealth: 0,
                totalExpenses: 0,
                netSavings: 0,
                totalInitialBalance: 0,
                banks: [],
                creditCards: [],
                cash: { balance: 0, initial_balance: 0 },
                trackingOption: 'both', // Default, will be updated when user info is fetched
                isCurrentMonth: false,
                isMonthCompleted: false,
                message: 'Future date selected - no data available'
            });
        }

        // Get user registration date and tracking option
        const userResult = await pool.query(
            'SELECT created_at, tracking_option FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const registrationDate = new Date(userResult.rows[0].created_at);
        const userTrackingOption = userResult.rows[0].tracking_option;
        const registrationMonth = registrationDate.getMonth() + 1;
        const registrationYear = registrationDate.getFullYear();

        // Check if selected date is before registration
        if (selectedYear < registrationYear ||
        (selectedYear === registrationYear && selectedMonth < registrationMonth)) {
            return res.json({
                monthlyIncome: 0,
                totalCurrentWealth: 0,
                totalExpenses: 0,
                netSavings: 0,
                totalInitialBalance: 0,
                banks: [],
                creditCards: [],
                cash: { balance: 0, initial_balance: 0 },
                trackingOption: userTrackingOption,
                isCurrentMonth: false,
                isMonthCompleted: true, // Before registration is considered "completed"
                message: 'Date before registration - no data available'
            });
        }

        // Get monthly income for selected month
        const incomeResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total_income FROM income_entries WHERE user_id = $1 AND month = $2 AND year = $3',
            [userId, selectedMonth, selectedYear]
        );

        // Get monthly expenses for selected month
        const expenseResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE user_id = $1 AND month = $2 AND year = $3',
            [userId, selectedMonth, selectedYear]
        );

        // Calculate balances as they were at the end of selected month
        const endOfSelectedMonth = new Date(selectedYear, selectedMonth, 0); // Last day of selected month

        // Get bank balances at the end of selected month
        const bankResult = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.initial_balance,
        b.initial_balance + 
        COALESCE((
          SELECT SUM(amount) 
          FROM income_entries 
          WHERE user_id = $1 
            AND credited_to_type = 'bank' 
            AND credited_to_id = b.id 
            AND date <= $2
        ), 0) - 
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE user_id = $1 
            AND payment_method = 'bank' 
            AND payment_source_id = b.id 
            AND date <= $2
        ), 0) as balance_at_month_end
      FROM banks b 
      WHERE b.user_id = $1 
        AND b.created_at <= $2
    `, [userId, endOfSelectedMonth]);

        // Get cash balance at the end of selected month
        const cashResult = await pool.query(`
      SELECT 
        initial_balance + 
        COALESCE((
          SELECT SUM(amount) 
          FROM income_entries 
          WHERE user_id = $1 
            AND credited_to_type = 'cash' 
            AND date <= $2
        ), 0) - 
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE user_id = $1 
            AND payment_method = 'cash' 
            AND date <= $2
        ), 0) as cash_balance_at_month_end,
        initial_balance
      FROM cash_balance 
      WHERE user_id = $1
    `, [userId, endOfSelectedMonth]);

        // Get credit cards only if user tracks expenses or both
        let creditCards = [];
        if (userTrackingOption === 'expenses' || userTrackingOption === 'both') {
            const creditCardResult = await pool.query(
                'SELECT * FROM credit_cards WHERE user_id = $1 AND created_at <= $2',
                [userId, endOfSelectedMonth]
            );
            // For each card, calculate used_limit as of end of selected month
            creditCards = await Promise.all(creditCardResult.rows.map(async card => {
                const usedResult = await pool.query(
                    `SELECT COALESCE(SUM(amount), 0) AS used_limit
                     FROM expenses
                     WHERE user_id = $1 AND payment_method = 'credit_card' AND payment_source_id = $2 AND date <= $3`,
                    [userId, card.id, endOfSelectedMonth]
                );
                return {
                    ...card,
                    current_balance: usedResult.rows[0].used_limit,
                    used_limit: usedResult.rows[0].used_limit
                };
            }));
        }

        // Calculate totals
        const monthIncome = parseFloat(incomeResult.rows[0]?.total_income || 0);
        const monthExpenses = parseFloat(expenseResult.rows[0]?.total_expenses || 0);

        // Calculate total wealth at end of selected month
        const totalBankBalance = bankResult.rows.reduce((sum, bank) =>
            sum + parseFloat(bank.balance_at_month_end || 0), 0);
        const cashBalance = parseFloat(cashResult.rows[0]?.cash_balance_at_month_end || 0);
        const totalCurrentWealth = totalBankBalance + cashBalance;

        // Calculate initial balance
        const totalInitialBankBalance = bankResult.rows.reduce((sum, bank) =>
            sum + parseFloat(bank.initial_balance || 0), 0);
        const initialCashBalance = parseFloat(cashResult.rows[0]?.initial_balance || 0);
        const totalInitialBalance = totalInitialBankBalance + initialCashBalance;

        // Net savings = Initial + Income - Expenses
        const netSavings = totalInitialBalance + monthIncome - monthExpenses;

        // Format bank data for response
        const banksWithHistoricalBalance = bankResult.rows.map(bank => ({
            ...bank,
            current_balance: bank.balance_at_month_end
        }));

        // Format cash data for response
        const cashData = {
            balance: cashResult.rows[0]?.cash_balance_at_month_end || 0,
            initial_balance: cashResult.rows[0]?.initial_balance || 0
        };

        res.json({
            monthlyIncome: monthIncome,
            totalCurrentWealth: totalCurrentWealth,
            totalExpenses: monthExpenses,
            netSavings: netSavings,
            totalInitialBalance: totalInitialBalance,
            banks: banksWithHistoricalBalance,
            creditCards: creditCards,
            cash: cashData,
            selectedMonth: selectedMonth,
            selectedYear: selectedYear,
            trackingOption: userTrackingOption,
            isCurrentMonth: isCurrentMonth,
            isMonthCompleted: isMonthCompleted,
            message: null
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to load monthly summary' });
    }
});
// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only start the server if this file is run directly (not during testing)
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {});
}

// Export the app for testing
module.exports = app;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });


// Export the app for testing
module.exports = app;
