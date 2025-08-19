// Add this to the top of both server.js and setup-db.js
/* eslint-disable no-unused-vars */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

const app = express();

const PORT = process.env.PORT || 3000;

// Trust proxy for correct client IP detection behind Railway/Heroku/etc
app.set('trust proxy', 1);

// Database connection
console.log('📊 Setting up database connection...');
console.log('Database config:');
console.log('- Host:', process.env.DB_HOST);
console.log('- Port:', process.env.DB_PORT);
console.log('- Database:', process.env.DB_NAME);
console.log('- User:', process.env.DB_USER);
console.log('- SSL:', process.env.DB_SSL);

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
});

// Test database connection
pool.connect()
    .then(client => {
        console.log('✅ Database connected successfully!');
        client.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:');
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('Error details:', err);
        console.error('Check your database environment variables!');
    });

// Rate limiting for authentication endpoints
// DEVELOPMENT: Rate limiting disabled for easier development
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    message: {
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Development bypass - no rate limiting
// const authLimiter = (req, res, next) => next();

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: { error: 'Too many requests. Please slow down.' },
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            scriptSrc: ['\'self\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
            fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
            connectSrc: ['\'self\''],
            imgSrc: ['\'self\'', 'data:', 'https:'],
            objectSrc: ['\'none\''],
            mediaSrc: ['\'self\''],
            frameSrc: ['\'none\''],
        },
    },
}));
app.use(generalLimiter);
app.use(bodyParser.json({ limit: '10mb' })); // Limit request size
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(
    session({
        store: new pgSession({ pool, createTableIfMissing: true  }),
        secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
        resave: false,
        saveUninitialized: false,
        name: 'sessionId', // Don't use default session name
        cookie: {
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            httpOnly: true, // Prevent XSS attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'strict', // CSRF protection
        },
    })
);

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
        const {
            username,
            password,
            name,
            email,
            securityQuestion,
            securityAnswer,
        } = req.body;

        // Server-side validation
        if (
            !username ||
      !password ||
      !name ||
      !email ||
      !securityQuestion ||
      !securityAnswer
        ) {
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
            return res
                .status(400)
                .json({
                    error: 'Username can only contain letters, numbers, and underscores',
                });
        }

        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res
                .status(400)
                .json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedSecurityAnswer = await bcrypt.hash(
            securityAnswer.toLowerCase().trim(),
            10
        );

        const result = await pool.query(
            'INSERT INTO users (username, password_hash, name, email, security_question, security_answer_hash, tracking_option) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [
                username,
                hashedPassword,
                name,
                email,
                securityQuestion,
                hashedSecurityAnswer,
                'both',
            ]
        );

        req.session.userId = result.rows[0].id;
        res.json({ success: true, userId: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') {
            // Unique constraint violation
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
            return res
                .status(400)
                .json({ error: 'Username and password are required' });
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            return res
                .status(400)
                .json({
                    error:
            'Invalid username format. Username can only contain letters, numbers, and underscores',
                });
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
            trackingOption: user.tracking_option,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set tracking option
app.post('/api/set-tracking-option', requireAuth, async (req, res) => {
    try {
        const { trackingOption } = req.body;
        await pool.query('UPDATE users SET tracking_option = $1 WHERE id = $2', [
            trackingOption,
            req.session.userId,
        ]);
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
            return res
                .status(404)
                .json({ error: 'No account found with this email address' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            username: user.username,
            name: user.name,
            message: 'Username found successfully',
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
                return res
                    .status(400)
                    .json({
                        error:
              'Invalid username format. Username can only contain letters, numbers, and underscores',
                    });
            }
        }

        let query, params;
        if (email) {
            query =
        'SELECT id, username, name, security_question FROM users WHERE email = $1';
            params = [email];
        } else {
            query =
        'SELECT id, username, name, security_question FROM users WHERE username = $1';
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
            securityQuestion: user.security_question,
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
        const isValidAnswer = await bcrypt.compare(
            securityAnswer.toLowerCase().trim(),
            user.security_answer_hash
        );

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

// Bank CRUD operations
app.put('/api/banks/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { name, initialBalance } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Bank name is required' });
        }

        if (initialBalance === undefined || isNaN(initialBalance) || parseFloat(initialBalance) < 0) {
            return res.status(400).json({ error: 'Valid initial balance is required' });
        }

        // Get current bank data
        const currentBank = await client.query(
            'SELECT * FROM banks WHERE id = $1 AND user_id = $2',
            [id, req.session.userId]
        );

        if (currentBank.rows.length === 0) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        const oldBalance = parseFloat(currentBank.rows[0].initial_balance);
        const newBalance = parseFloat(initialBalance);
        const balanceDifference = newBalance - oldBalance;

        // Update bank
        const result = await client.query(
            'UPDATE banks SET name = $1, initial_balance = $2, current_balance = current_balance + $3 WHERE id = $4 AND user_id = $5 RETURNING *',
            [name.trim(), newBalance, balanceDifference, id, req.session.userId]
        );

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.delete('/api/banks/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;

        // Check if bank has transactions
        const transactions = await client.query(
            'SELECT COUNT(*) FROM income_entries WHERE user_id = $1 AND credited_to_type = $2 AND credited_to_id = $3 UNION ALL SELECT COUNT(*) FROM expense_entries WHERE user_id = $1 AND debited_from_type = $2 AND debited_from_id = $3',
            [req.session.userId, 'bank', id]
        );

        const totalTransactions = transactions.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

        if (totalTransactions > 0) {
            return res.status(400).json({
                error: 'Cannot delete bank with existing transactions. Please delete all related transactions first.'
            });
        }

        // Delete bank
        const result = await client.query(
            'DELETE FROM banks WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Bank deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Credit Card CRUD operations
app.put('/api/credit-cards/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, creditLimit } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Card name is required' });
        }

        if (creditLimit === undefined || isNaN(creditLimit) || parseFloat(creditLimit) <= 0) {
            return res.status(400).json({ error: 'Valid credit limit greater than 0 is required' });
        }

        // Check if card exists and belongs to user
        const currentCard = await pool.query(
            'SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2',
            [id, req.session.userId]
        );

        if (currentCard.rows.length === 0) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const currentUsedLimit = parseFloat(currentCard.rows[0].used_limit);
        const newCreditLimit = parseFloat(creditLimit);

        // Check if new credit limit is not less than used limit
        if (newCreditLimit < currentUsedLimit) {
            return res.status(400).json({
                error: `Credit limit cannot be less than used limit (₹${currentUsedLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
            });
        }

        // Update credit card
        const result = await pool.query(
            'UPDATE credit_cards SET name = $1, credit_limit = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
            [name.trim(), newCreditLimit, id, req.session.userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/credit-cards/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;

        // Check if credit card has transactions
        const transactions = await client.query(
            'SELECT COUNT(*) FROM expense_entries WHERE user_id = $1 AND debited_from_type = $2 AND debited_from_id = $3',
            [req.session.userId, 'credit_card', id]
        );

        if (parseInt(transactions.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete credit card with existing transactions. Please delete all related transactions first.'
            });
        }

        // Delete credit card
        const result = await pool.query(
            'DELETE FROM credit_cards WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Credit card deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Income operations
app.post('/api/income', requireAuth, async (req, res) => {
    try {
        const { source, amount, creditedToType, creditedToId, date } = req.body;
        
        // Validate date input
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        // If only date is provided (YYYY-MM-DD), add current time to make it more realistic
        let finalDate = date;
        if (date && date.length === 10) { // YYYY-MM-DD format
            const now = new Date();
            const selectedDate = new Date(date);
            
            // Check if the date is valid and hasn't been auto-corrected
            if (isNaN(selectedDate.getTime()) || selectedDate.toISOString().split('T')[0] !== date) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            
            selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            finalDate = selectedDate.toISOString();
        }
        
        const dateObj = new Date(finalDate);
        
        // Validate the final date
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        const result = await pool.query(
            'INSERT INTO income_entries (user_id, source, amount, credited_to_type, credited_to_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [
                req.session.userId,
                source,
                amount,
                creditedToType,
                creditedToId,
                finalDate,
                month,
                year,
            ]
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
        let query = `
            SELECT i.*, 
                   CASE 
                       WHEN i.credited_to_type = 'bank' THEN b.name
                       WHEN i.credited_to_type = 'cash' THEN 'Cash'
                       WHEN i.credited_to_type = 'credit_card' THEN cc.name
                       ELSE 'Unknown'
                   END as credited_to_name
            FROM income_entries i
            LEFT JOIN banks b ON i.credited_to_type = 'bank' AND i.credited_to_id = b.id
            LEFT JOIN credit_cards cc ON i.credited_to_type = 'credit_card' AND i.credited_to_id = cc.id
            WHERE i.user_id = $1`;
        const params = [req.session.userId];

        if (month && year) {
            query += ' AND i.month = $2 AND i.year = $3';
            params.push(month, year);
        }

        query += ' ORDER BY i.date DESC';

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
        
        // Validate date input
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        // If only date is provided (YYYY-MM-DD), add current time to make it more realistic
        let finalDate = date;
        if (date && date.length === 10) { // YYYY-MM-DD format
            const now = new Date();
            const selectedDate = new Date(date);
            
            // Check if the date is valid and hasn't been auto-corrected
            if (isNaN(selectedDate.getTime()) || selectedDate.toISOString().split('T')[0] !== date) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            
            selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            finalDate = selectedDate.toISOString();
        }
        
        const dateObj = new Date(finalDate);
        
        // Validate the final date
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
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

                if (
                    bankResult.rows.length === 0 ||
          bankResult.rows[0].current_balance < amount
                ) {
                    return res.status(400).json({ error: 'Insufficient bank balance' });
                }
            } else if (paymentMethod === 'cash') {
                const cashResult = await pool.query(
                    'SELECT balance FROM cash_balance WHERE user_id = $1',
                    [req.session.userId]
                );

                if (
                    cashResult.rows.length === 0 ||
          cashResult.rows[0].balance < amount
                ) {
                    return res.status(400).json({ error: 'Insufficient cash balance' });
                }
            } else if (paymentMethod === 'credit_card') {
                const ccResult = await pool.query(
                    'SELECT credit_limit, used_limit FROM credit_cards WHERE id = $1 AND user_id = $2',
                    [paymentSourceId, req.session.userId]
                );

                if (
                    ccResult.rows.length === 0 ||
          ccResult.rows[0].credit_limit - ccResult.rows[0].used_limit < amount
                ) {
                    return res.status(400).json({ error: 'Insufficient credit limit' });
                }
            }
        }

        const result = await pool.query(
            'INSERT INTO expenses (user_id, title, amount, payment_method, payment_source_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [
                req.session.userId,
                title,
                amount,
                paymentMethod,
                paymentSourceId,
                finalDate,
                month,
                year,
            ]
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
        let query = `
            SELECT e.*, 
                   CASE 
                       WHEN e.payment_method = 'bank' THEN b.name
                       WHEN e.payment_method = 'cash' THEN 'Cash'
                       WHEN e.payment_method = 'credit_card' THEN cc.name
                       ELSE 'Unknown'
                   END as payment_source_name
            FROM expenses e
            LEFT JOIN banks b ON e.payment_method = 'bank' AND e.payment_source_id = b.id
            LEFT JOIN credit_cards cc ON e.payment_method = 'credit_card' AND e.payment_source_id = cc.id
            WHERE e.user_id = $1`;
        const params = [req.session.userId];

        if (month && year) {
            query += ' AND e.month = $2 AND e.year = $3';
            params.push(month, year);
        }

        query += ' ORDER BY e.date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== INCOME CRUD OPERATIONS =====

// Get individual income transaction
app.get('/api/income/:id', requireAuth, async (req, res) => {
    try {
        const incomeId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM income_entries WHERE id = $1 AND user_id = $2',
            [incomeId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Income transaction not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update income transaction
app.put('/api/income/:id', requireAuth, async (req, res) => {
    try {
        const incomeId = req.params.id;
        const { source, amount, creditedToType, creditedToId, date } = req.body;
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        // Get current transaction for balance calculation
        const currentResult = await pool.query(
            'SELECT * FROM income_entries WHERE id = $1 AND user_id = $2',
            [incomeId, req.session.userId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Income transaction not found' });
        }

        const currentIncome = currentResult.rows[0];

        // Begin transaction for balance updates
        await pool.query('BEGIN');

        try {
            // Reverse the previous transaction effect
            if (currentIncome.credited_to_type === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentIncome.amount, currentIncome.credited_to_id, req.session.userId]
                );
            } else if (currentIncome.credited_to_type === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount - $1 WHERE user_id = $2',
                    [currentIncome.amount, req.session.userId]
                );
            }

            // Update the income transaction
            await pool.query(
                'UPDATE income_entries SET source = $1, amount = $2, credited_to_type = $3, credited_to_id = $4, date = $5, month = $6, year = $7 WHERE id = $8 AND user_id = $9',
                [source, amount, creditedToType, creditedToId, dateObj, month, year, incomeId, req.session.userId]
            );

            // Apply the new transaction effect
            if (creditedToType === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [amount, creditedToId, req.session.userId]
                );
            } else if (creditedToType === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount + $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            }

            await pool.query('COMMIT');
            res.json({ success: true, message: 'Income transaction updated successfully' });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete income transaction
app.delete('/api/income/:id', requireAuth, async (req, res) => {
    try {
        const incomeId = req.params.id;

        // Get current transaction for balance calculation
        const currentResult = await pool.query(
            'SELECT * FROM income_entries WHERE id = $1 AND user_id = $2',
            [incomeId, req.session.userId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Income transaction not found' });
        }

        const currentIncome = currentResult.rows[0];

        // Begin transaction for balance updates
        await pool.query('BEGIN');

        try {
            // Reverse the transaction effect
            if (currentIncome.credited_to_type === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentIncome.amount, currentIncome.credited_to_id, req.session.userId]
                );
            } else if (currentIncome.credited_to_type === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount - $1 WHERE user_id = $2',
                    [currentIncome.amount, req.session.userId]
                );
            }

            // Delete the income transaction
            await pool.query(
                'DELETE FROM income_entries WHERE id = $1 AND user_id = $2',
                [incomeId, req.session.userId]
            );

            await pool.query('COMMIT');
            res.json({ success: true, message: 'Income transaction deleted successfully' });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== EXPENSE CRUD OPERATIONS =====

// Get individual expense transaction
app.get('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expenseId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
            [expenseId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Expense transaction not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update expense transaction
app.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expenseId = req.params.id;
        const { title, amount, paymentMethod, paymentSourceId, date } = req.body;
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        // Get current transaction for balance calculation
        const currentResult = await pool.query(
            'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
            [expenseId, req.session.userId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Expense transaction not found' });
        }

        const currentExpense = currentResult.rows[0];

        // Begin transaction for balance updates
        await pool.query('BEGIN');

        try {
            // Reverse the previous transaction effect
            if (currentExpense.payment_method === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'credit_card') {
                await pool.query(
                    'UPDATE credit_cards SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount + $1 WHERE user_id = $2',
                    [currentExpense.amount, req.session.userId]
                );
            }

            // Update the expense transaction
            await pool.query(
                'UPDATE expenses SET title = $1, amount = $2, payment_method = $3, payment_source_id = $4, date = $5, month = $6, year = $7 WHERE id = $8 AND user_id = $9',
                [title, amount, paymentMethod, paymentSourceId, dateObj, month, year, expenseId, req.session.userId]
            );

            // Apply the new transaction effect
            if (paymentMethod === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'credit_card') {
                await pool.query(
                    'UPDATE credit_cards SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount - $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            }

            await pool.query('COMMIT');
            res.json({ success: true, message: 'Expense transaction updated successfully' });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete expense transaction
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expenseId = req.params.id;

        // Get current transaction for balance calculation
        const currentResult = await pool.query(
            'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
            [expenseId, req.session.userId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Expense transaction not found' });
        }

        const currentExpense = currentResult.rows[0];

        // Begin transaction for balance updates
        await pool.query('BEGIN');

        try {
            // Reverse the transaction effect
            if (currentExpense.payment_method === 'bank') {
                await pool.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'credit_card') {
                await pool.query(
                    'UPDATE credit_cards SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'cash') {
                await pool.query(
                    'UPDATE cash_balance SET amount = amount + $1 WHERE user_id = $2',
                    [currentExpense.amount, req.session.userId]
                );
            }

            // Delete the expense transaction
            await pool.query(
                'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
                [expenseId, req.session.userId]
            );

            await pool.query('COMMIT');
            res.json({ success: true, message: 'Expense transaction deleted successfully' });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

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
        const isCurrentMonth =
      selectedMonth === currentMonth && selectedYear === currentYear;
        const isMonthCompleted =
      selectedYear < currentYear ||
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
                message: 'Future date selected - no data available',
            });
        }

        // Get user registration date and tracking option
        let userResult;
        try {
            userResult = await pool.query(
                'SELECT created_at, COALESCE(tracking_option, \'both\') as tracking_option FROM users WHERE id = $1',
                [userId]
            );
        } catch (error) {
            console.log('Tracking option column might not exist, using fallback query');
            // Fallback if tracking_option column doesn't exist
            userResult = await pool.query(
                'SELECT created_at, \'both\' as tracking_option FROM users WHERE id = $1',
                [userId]
            );
        }

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const registrationDate = new Date(userResult.rows[0].created_at);
        const userTrackingOption = userResult.rows[0].tracking_option;
        const registrationMonth = registrationDate.getMonth() + 1;
        const registrationYear = registrationDate.getFullYear();

        // Check if selected date is before registration
        if (
            selectedYear < registrationYear ||
      (selectedYear === registrationYear && selectedMonth < registrationMonth)
        ) {
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
                message: 'Date before registration - no data available',
            });
        }

        // Get monthly income for selected month
        const incomeResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total_income FROM income_entries WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3',
            [userId, selectedMonth, selectedYear]
        );

        // Get monthly expenses for selected month
        const expenseResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3',
            [userId, selectedMonth, selectedYear]
        );

        // Calculate balances as they were at the end of selected month
        const endOfSelectedMonth = new Date(selectedYear, selectedMonth, 0); // Last day of selected month

        // Get bank balances at the end of selected month
        const bankResult = await pool.query(
            `
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
    `,
            [userId, endOfSelectedMonth]
        );

        // Get cash balance at the end of selected month
        const cashResult = await pool.query(
            `
      SELECT
        COALESCE(balance, 0) as initial_balance,
        COALESCE(balance, 0) +
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
        ), 0) as cash_balance_at_month_end
      FROM cash_balance
      WHERE user_id = $1
    `,
            [userId, endOfSelectedMonth]
        );

        // If no cash balance record exists, create default values
        if (cashResult.rows.length === 0) {
            cashResult.rows = [{
                initial_balance: 0,
                cash_balance_at_month_end: 0
            }];
        }

        // Get credit cards only if user tracks expenses or both
        let creditCards = [];
        if (userTrackingOption === 'expenses' || userTrackingOption === 'both') {
            const creditCardResult = await pool.query(
                'SELECT * FROM credit_cards WHERE user_id = $1 AND created_at <= $2',
                [userId, endOfSelectedMonth]
            );
            // For each card, calculate used_limit as of end of selected month
            creditCards = await Promise.all(
                creditCardResult.rows.map(async (card) => {
                    const usedResult = await pool.query(
                        `SELECT COALESCE(SUM(amount), 0) AS used_limit
                     FROM expenses
                     WHERE user_id = $1 AND payment_method = 'credit_card' AND payment_source_id = $2 AND date <= $3`,
                        [userId, card.id, endOfSelectedMonth]
                    );
                    return {
                        ...card,
                        current_balance: usedResult.rows[0].used_limit,
                        used_limit: usedResult.rows[0].used_limit,
                    };
                })
            );
        }

        // Calculate totals
        const monthIncome = parseFloat(incomeResult.rows[0]?.total_income || 0);
        const monthExpenses = parseFloat(
            expenseResult.rows[0]?.total_expenses || 0
        );

        // Calculate total wealth at end of selected month
        const totalBankBalance = bankResult.rows.reduce(
            (sum, bank) => sum + parseFloat(bank.balance_at_month_end || 0),
            0
        );
        const cashBalance = parseFloat(
            cashResult.rows[0]?.cash_balance_at_month_end || 0
        );
        const totalCurrentWealth = totalBankBalance + cashBalance;

        // Calculate initial balance
        const totalInitialBankBalance = bankResult.rows.reduce(
            (sum, bank) => sum + parseFloat(bank.initial_balance || 0),
            0
        );
        const initialCashBalance = parseFloat(
            cashResult.rows[0]?.initial_balance || 0
        );
        const totalInitialBalance = totalInitialBankBalance + initialCashBalance;

        // Net savings = Initial + Income - Expenses
        const netSavings = totalInitialBalance + monthIncome - monthExpenses;

        // Format bank data for response
        const banksWithHistoricalBalance = bankResult.rows.map((bank) => ({
            ...bank,
            current_balance: bank.balance_at_month_end,
        }));

        // Format cash data for response
        const cashData = {
            balance: cashResult.rows[0]?.cash_balance_at_month_end || 0,
            initial_balance: cashResult.rows[0]?.initial_balance || 0,
        };

        // Check if user has no activity for this month (registered but no transactions)
        const hasNoTransactions = monthIncome === 0 && monthExpenses === 0;
        const hasNoAccountsSetup = bankResult.rows.length === 0 && (cashResult.rows[0]?.initial_balance || 0) === 0;

        // If user was registered during this month but has no transactions or account setup
        if (hasNoTransactions && hasNoAccountsSetup) {
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
                isCurrentMonth: isCurrentMonth,
                isMonthCompleted: isMonthCompleted,
                message: 'No transactions found for this month',
            });
        }

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
            message: null,
        });
    } catch (error) {
        console.error('Monthly summary error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            query: error.query || 'No query info'
        });
        res.status(500).json({ error: 'Failed to load monthly summary', details: error.message });
    }
});

// Debug endpoint to test database without auth
app.get('/api/debug-monthly', async (req, res) => {
    try {
        const { month = 8, year = 2025, userId = 1 } = req.query;

        console.log('Debug monthly summary for:', { month, year, userId });

        // Simple test query
        const testResult = await pool.query(
            'SELECT COUNT(*) as count FROM users WHERE id = $1',
            [userId]
        );

        console.log('User exists:', testResult.rows[0]);

        res.json({
            success: true,
            userExists: testResult.rows[0].count > 0,
            testParams: { month, year, userId }
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // or your session cookie name
        res.json({ success: true });
    });
});

// User Activity Tracking API with Audit Logs
app.get('/api/activity', requireAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type = '',
            from_date = '',
            to_date = '',
            month = '',
            year = '',
            export: exportCsv = false
        } = req.query;

        const userId = req.session.userId;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build WHERE conditions for filtering
        const whereConditions = [];
        const params = [userId];
        let paramCount = 1;

        // Handle month/year filtering
        if (month && year) {
            paramCount++;
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            whereConditions.push(`activity_date >= $${paramCount}`);
            params.push(startDate);
            
            paramCount++;
            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
            whereConditions.push(`activity_date < $${paramCount}`);
            params.push(endDate);
        } else if (year) {
            paramCount++;
            whereConditions.push(`activity_date >= $${paramCount}`);
            params.push(`${year}-01-01`);
            
            paramCount++;
            whereConditions.push(`activity_date < $${paramCount}`);
            params.push(`${parseInt(year) + 1}-01-01`);
        } else {
            // Handle date range filtering
            if (from_date) {
                paramCount++;
                whereConditions.push(`activity_date >= $${paramCount}`);
                params.push(from_date);
            }

            if (to_date) {
                paramCount++;
                whereConditions.push(`activity_date <= $${paramCount}`);
                params.push(to_date);
            }
        }

        // Enhanced activities query with audit logs - simplified version
        let activitiesQuery = `
            SELECT
                activity_type,
                id,
                description,
                amount,
                account_info,
                activity_date,
                action_type
            FROM (
                -- Income transactions (created)
                SELECT
                    'income' as activity_type,
                    i.id,
                    i.source as description,
                    i.amount,
                    CASE
                        WHEN i.credited_to_type = 'bank' THEN COALESCE(b.name, 'Unknown Bank')
                        WHEN i.credited_to_type = 'cash' THEN 'Cash'
                        ELSE i.credited_to_type
                    END as account_info,
                    i.date as activity_date,
                    'created' as action_type
                FROM income_entries i
                LEFT JOIN banks b ON i.credited_to_type = 'bank' AND i.credited_to_id = b.id AND b.user_id = i.user_id
                WHERE i.user_id = $1

                UNION ALL

                -- Expense transactions (created)
                SELECT
                    'expense' as activity_type,
                    e.id,
                    e.title as description,
                    e.amount,
                    CASE
                        WHEN e.payment_method = 'bank' THEN COALESCE(b.name, 'Unknown Bank')
                        WHEN e.payment_method = 'credit_card' THEN COALESCE(c.name, 'Unknown Card')
                        WHEN e.payment_method = 'cash' THEN 'Cash'
                        ELSE e.payment_method
                    END as account_info,
                    e.date as activity_date,
                    'created' as action_type
                FROM expenses e
                LEFT JOIN banks b ON e.payment_method = 'bank' AND e.payment_source_id = b.id AND b.user_id = e.user_id
                LEFT JOIN credit_cards c ON e.payment_method = 'credit_card' AND e.payment_source_id = c.id AND c.user_id = e.user_id
                WHERE e.user_id = $1

                UNION ALL

                -- Bank setup activities
                SELECT
                    'setup' as activity_type,
                    b.id,
                    'Added bank: ' || b.name as description,
                    b.initial_balance as amount,
                    b.name as account_info,
                    b.created_at as activity_date,
                    'created' as action_type
                FROM banks b
                WHERE b.user_id = $1

                UNION ALL

                -- Credit card setup activities
                SELECT
                    'setup' as activity_type,
                    c.id,
                    'Added credit card: ' || c.name as description,
                    c.credit_limit as amount,
                    c.name as account_info,
                    c.created_at as activity_date,
                    'created' as action_type
                FROM credit_cards c
                WHERE c.user_id = $1

                UNION ALL

                -- Cash balance setup activities
                SELECT
                    'setup' as activity_type,
                    cb.id,
                    'Set cash balance' as description,
                    cb.initial_balance as amount,
                    'Cash' as account_info,
                    cb.updated_at as activity_date,
                    'created' as action_type
                FROM cash_balance cb
                WHERE cb.user_id = $1 AND cb.initial_balance > 0
            ) combined_activities
        `;

        // Apply filtering
        if (whereConditions.length > 0) {
            activitiesQuery += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        // Apply type filtering if specified
        if (type && type !== '') {
            activitiesQuery += whereConditions.length > 0 ? ` AND activity_type = '${type}'` : ` WHERE activity_type = '${type}'`;
        }

        activitiesQuery += ' ORDER BY activity_date DESC';

        // For CSV export, don't limit results
        if (!exportCsv) {
            activitiesQuery += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
        }

        const activitiesResult = await pool.query(activitiesQuery, params);

        // Get count for pagination - simplified
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT id FROM income_entries WHERE user_id = $1
                UNION ALL
                SELECT id FROM expenses WHERE user_id = $1
                UNION ALL
                SELECT id FROM banks WHERE user_id = $1
                UNION ALL
                SELECT id FROM credit_cards WHERE user_id = $1
                UNION ALL
                SELECT id FROM cash_balance WHERE user_id = $1 AND initial_balance > 0
            ) combined_count
        `;

        const countResult = await pool.query(countQuery, [userId]);
        const totalItems = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalItems / parseInt(limit));

        // Get summary statistics
        const statsResult = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM income_entries WHERE user_id = $1) +
                (SELECT COUNT(*) FROM expenses WHERE user_id = $1) +
                (SELECT COUNT(*) FROM banks WHERE user_id = $1) +
                (SELECT COUNT(*) FROM credit_cards WHERE user_id = $1) +
                (SELECT COUNT(*) FROM cash_balance WHERE user_id = $1 AND initial_balance > 0) as totalTransactions,
                (SELECT COALESCE(SUM(amount), 0) FROM income_entries WHERE user_id = $1) as totalIncome,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1) as totalExpenses,
                (SELECT COALESCE(SUM(amount), 0) FROM income_entries WHERE user_id = $1) -
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1) as netBalance
        `, [userId]);

        // Handle CSV export
        if (exportCsv) {
            const csvHeaders = 'Date,Type,Description,Amount,Account\n';
            const csvRows = activitiesResult.rows.map(activity => {
                const date = new Date(activity.activity_date).toLocaleDateString();
                const amount = parseFloat(activity.amount || 0).toFixed(2);
                return `${date},${activity.activity_type},"${activity.description}",${amount},"${activity.account_info || ''}"`;
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=activity-export.csv');
            return res.send(csvHeaders + csvRows);
        }

        res.json({
            activities: activitiesResult.rows,
            statistics: statsResult.rows[0] || {
                totalTransactions: 0,
                totalIncome: 0,
                totalExpenses: 0,
                netBalance: 0
            },
            currentPage: parseInt(page),
            totalPages: totalPages,
            totalItems: totalItems,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        }
        next();
    });
}

// Export the app and pool for testing
module.exports = { app, pool };

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
    console.log('🚀 Starting Express server...');
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
        console.log(`🔗 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        console.log('🎉 BalanceTrack is ready!');
    });
}
