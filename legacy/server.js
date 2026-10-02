// Add this to the top of both server.js and setup-db.js
/* eslint-disable no-unused-vars */
require('dotenv').config({ quiet: true });
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const { withTransaction, RequestError } = require('./lib/transaction');

// Without a fixed secret each Vercel instance would sign sessions with its own random key,
// logging users out whenever a request lands on a different instance
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production');
}

const app = express();

const PORT = process.env.PORT || 3000;

// Trust proxy for correct client IP detection behind reverse proxies
app.set('trust proxy', 1);

// Database connection
console.log('Setting up database connection...');
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
    // Optional Postgres schema; tests use balancetrack_test, production uses public
    ...(process.env.DB_SCHEMA && { options: `-c search_path=${process.env.DB_SCHEMA}` }),
    // Fail instead of hanging when the database or its pooler stalls: no time limit used to mean
    // a stalled connection held its request open indefinitely. Client-side limits, so they work
    // through the Supabase transaction pooler.
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
    keepAlive: true,
});

// Test database connection (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    pool.connect()
        .then(client => {
            console.log('Database connected successfully!');
            client.release();
        })
        .catch(err => {
            console.error('Database connection failed:');
            console.error('Error code:', err.code);
            console.error('Error message:', err.message);
            console.error('Error details:', err);
            console.error('Check your database environment variables!');
        });
}

// Rate limiting for authentication endpoints (skipped in development and test)
const skipAuthLimit = ['development', 'test'].includes(process.env.NODE_ENV);
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 failed attempts per window per IP
    skipSuccessfulRequests: true,
    message: {
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => skipAuthLimit,
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: { error: 'Too many requests. Please slow down.' },
    // End-to-end tests drive a real server faster than a person would
    skip: () => process.env.NODE_ENV === 'test',
});

// Redirect HTTP to HTTPS in production (must run before static files and routes).
// Only redirect when the proxy reports plain HTTP, so internal health checks still work.
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] === 'http') {
            return res.redirect(301, 'https://' + req.headers.host + req.url);
        }
        next();
    });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            scriptSrc: ['\'self\'', 'https://unpkg.com'],
            // style attributes are used in index.html and in rendered summary/transaction markup
            styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
            fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
            imgSrc: ['\'self\'', 'data:'],
            connectSrc: ['\'self\''],
            // Safari applies upgrade-insecure-requests to http://localhost, which breaks local dev
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
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
            maxAge: 2 * 60 * 60 * 1000, // 2 hours (Professional Standard)
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

// Activity logging function
// Write an activity log entry on the caller's transaction connection, so the entry commits or
// rolls back together with the change it describes. Errors propagate and abort that transaction.
async function logActivity(client, userId, actionType, entityType, entityId, description, amount = null, oldValues = null, newValues = null) {
    await client.query(
        'INSERT INTO activity_log (user_id, action_type, entity_type, entity_id, description, amount, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, actionType, entityType, entityId, description, amount, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
    );
}

// An entry's calendar date as stored: YYYY-MM-DD with its month and year, read from the string
// itself. Converting through the server's local time moved entries across midnight (an entry
// added just after midnight IST was stored as the previous day, under the new month).
function entryDate(value) {
    if (typeof value !== 'string' || value === '') return null;
    let day = value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) return null;
        day = parsed.toISOString().slice(0, 10);
    }
    const [year, month, dayOfMonth] = day.split('-').map(Number);
    // Rejects dates that do not exist, such as 2026-02-30
    if (new Date(Date.UTC(year, month - 1, dayOfMonth)).toISOString().slice(0, 10) !== day) return null;
    return { date: day, month, year };
}

// One CSV field: always quoted, quotes doubled, and text a spreadsheet would run as a formula
// (starting with = + - @, tab or carriage return) prefixed with an apostrophe
function csvField(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

// Send the response for an error thrown inside a route: expected RequestErrors carry their own
// status; anything else is a generic 500
function sendError(res, error, fallbackMessage = 'An error occurred. Please try again.') {
    if (error instanceof RequestError) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: fallbackMessage });
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

        // Input length limits
        if (username.length > 50)  return res.status(400).json({ error: 'Username too long (max 50 characters)' });
        if (name.length > 100)     return res.status(400).json({ error: 'Name too long (max 100 characters)' });
        if (email.length > 255)    return res.status(400).json({ error: 'Email too long (max 255 characters)' });
        if (securityAnswer.length > 200) return res.status(400).json({ error: 'Security answer too long (max 200 characters)' });

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

        // Regenerate session to prevent session fixation
        const userData = { id: user.id, name: user.name, tracking_option: user.tracking_option };
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ error: 'Login failed. Please try again.' });
            }
            req.session.userId = userData.id;
            res.json({
                success: true,
                userId: userData.id,
                name: userData.name,
                trackingOption: userData.tracking_option,
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Set tracking option
app.post('/api/set-tracking-option', requireAuth, async (req, res) => {
    try {
        const { trackingOption } = req.body;
        const validOptions = ['income', 'expenses', 'both'];
        if (!validOptions.includes(trackingOption)) {
            return res.status(400).json({ error: 'Invalid tracking option' });
        }
        await pool.query('UPDATE users SET tracking_option = $1 WHERE id = $2', [
            trackingOption,
            req.session.userId,
        ]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred. Please try again.' });
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Account recovery. Responses never reveal whether an account exists: an unknown username or
// email gets a stable made-up security question, and every failed answer (unknown account, wrong
// answer, or recovery paused) gets the same message. Failed answers are recorded in the account's
// activity log, and after RECOVERY_MAX_FAILURES within RECOVERY_WINDOW_MINUTES recovery pauses.
const RECOVERY_QUESTIONS = ['pet', 'school', 'city', 'mother', 'car', 'street'];
const RECOVERY_MAX_FAILURES = 5;
const RECOVERY_WINDOW_MINUTES = 15;
const RECOVERY_FAILED_MESSAGE = `Security answer could not be verified. Check it and try again; after ${RECOVERY_MAX_FAILURES} failed attempts, recovery is paused for ${RECOVERY_WINDOW_MINUTES} minutes.`;
const RECOVERY_KEY = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
// Unknown or paused accounts still cost one bcrypt comparison, so timing does not tell them apart
let dummyAnswerHash;
async function compareWithDummy(answer) {
    dummyAnswerHash = dummyAnswerHash || bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10);
    await bcrypt.compare(answer, await dummyAnswerHash);
}

/** The lookup column and value from { username } or { email }, or a format error (which reveals nothing) */
function recoveryIdentifier({ username, email }, { emailOnly = false } = {}) {
    if (email) {
        if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { error: 'Invalid email format' };
        }
        return { column: 'email', value: email };
    }
    if (emailOnly) return { error: 'Email is required' };
    if (username) {
        if (typeof username !== 'string' || username.length > 50 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            return { error: 'Invalid username format. Username can only contain letters, numbers, and underscores' };
        }
        return { column: 'username', value: username };
    }
    return { error: 'Username or email is required' };
}

async function findRecoveryUser({ column, value }) {
    // column comes from recoveryIdentifier, never from the request
    const result = await pool.query(
        `SELECT id, username, security_question, security_answer_hash FROM users WHERE ${column === 'email' ? 'email' : 'username'} = $1`,
        [value]
    );
    return result.rows[0] || null;
}

/** The question to show: the account's own, or one derived from the identifier so repeated lookups match */
function recoveryQuestion(user, value) {
    if (user) return user.security_question;
    const digest = require('crypto').createHmac('sha256', RECOVERY_KEY).update(value.trim().toLowerCase()).digest();
    return RECOVERY_QUESTIONS[digest.readUInt32BE(0) % RECOVERY_QUESTIONS.length];
}

/** True when the answer is right and recovery is not paused; records each wrong answer */
async function checkRecoveryAnswer(user, securityAnswer) {
    const answer = securityAnswer.toLowerCase().trim();
    if (!user) {
        await compareWithDummy(answer);
        return false;
    }
    const failures = await pool.query(
        `SELECT COUNT(*)::int AS n FROM activity_log
         WHERE user_id = $1 AND action_type = 'recovery_failed' AND created_at > LOCALTIMESTAMP - make_interval(mins => $2)`,
        [user.id, RECOVERY_WINDOW_MINUTES]
    );
    if (failures.rows[0].n >= RECOVERY_MAX_FAILURES) {
        await compareWithDummy(answer);
        return false;
    }
    if (await bcrypt.compare(answer, user.security_answer_hash)) return true;
    // A single insert on its own: it must persist even though the request fails
    await logActivity(pool, user.id, 'recovery_failed', 'account', user.id, 'Failed account recovery attempt: wrong security answer');
    return false;
}

function validRecoveryAnswer(securityAnswer) {
    return typeof securityAnswer === 'string' && securityAnswer.trim() !== '' && securityAnswer.length <= 200;
}

// Forgot username. Step 1, { email }: the security question. Step 2, { email, securityAnswer }: the username.
app.post('/api/forgot-username', authLimiter, async (req, res) => {
    try {
        const identifier = recoveryIdentifier({ email: req.body.email }, { emailOnly: true });
        if (identifier.error) return res.status(400).json({ error: identifier.error });
        const user = await findRecoveryUser(identifier);

        if (req.body.securityAnswer === undefined) {
            return res.json({ success: true, securityQuestion: recoveryQuestion(user, identifier.value) });
        }
        if (!validRecoveryAnswer(req.body.securityAnswer)) {
            return res.status(400).json({ error: 'Security answer is required' });
        }
        if (!(await checkRecoveryAnswer(user, req.body.securityAnswer))) {
            return res.status(400).json({ error: RECOVERY_FAILED_MESSAGE });
        }
        res.json({ success: true, username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Password reset step 1, { username } or { email }: the security question
app.post('/api/forgot-password', authLimiter, async (req, res) => {
    try {
        const identifier = recoveryIdentifier(req.body);
        if (identifier.error) return res.status(400).json({ error: identifier.error });
        const user = await findRecoveryUser(identifier);
        res.json({ success: true, securityQuestion: recoveryQuestion(user, identifier.value) });
    } catch (error) {
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Password reset step 2, { username or email, securityAnswer, newPassword }. A reset signs the
// account out everywhere and is recorded in its activity log.
app.post('/api/reset-password', authLimiter, async (req, res) => {
    try {
        const { securityAnswer, newPassword } = req.body;
        const identifier = recoveryIdentifier(req.body);
        if (identifier.error) return res.status(400).json({ error: identifier.error });
        if (!validRecoveryAnswer(securityAnswer) || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        const user = await findRecoveryUser(identifier);
        if (!(await checkRecoveryAnswer(user, securityAnswer))) {
            return res.status(400).json({ error: RECOVERY_FAILED_MESSAGE });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await withTransaction(pool, async (client) => {
            await client.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [hashedNewPassword, user.id]
            );
            await client.query('DELETE FROM session WHERE sess->>\'userId\' = $1', [String(user.id)]);
            await logActivity(client, user.id, 'password_reset', 'account', user.id, 'Password reset through the security question; all sessions signed out');
        });

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

        const newBank = await withTransaction(pool, async (client) => {
            const result = await client.query(
                'INSERT INTO banks (user_id, name, initial_balance, current_balance) VALUES ($1, $2, $3, $3) RETURNING *',
                [req.session.userId, upperName, initialBalance || 0]
            );
            const bank = result.rows[0];

            await logActivity(
                client,
                req.session.userId,
                'create',
                'bank',
                bank.id,
                `Added bank account: ${upperName}`,
                initialBalance || 0,
                null,
                {
                    name: upperName,
                    initialBalance: initialBalance || 0,
                    currentBalance: initialBalance || 0
                }
            );
            return bank;
        });

        res.json(newBank);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Bank already exists' });
        } else {
            res.status(500).json({ error: 'An error occurred. Please try again.' });
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Credit card operations
app.post('/api/credit-cards', requireAuth, async (req, res) => {
    try {
        const { name, creditLimit } = req.body;
        const upperName = name.toUpperCase();

        const newCard = await withTransaction(pool, async (client) => {
            const result = await client.query(
                'INSERT INTO credit_cards (user_id, name, credit_limit) VALUES ($1, $2, $3) RETURNING *',
                [req.session.userId, upperName, creditLimit]
            );
            const card = result.rows[0];

            await logActivity(
                client,
                req.session.userId,
                'create',
                'credit_card',
                card.id,
                `Added credit card: ${upperName}`,
                creditLimit,
                null,
                {
                    name: upperName,
                    creditLimit: creditLimit,
                    usedLimit: 0,
                    availableLimit: creditLimit
                }
            );
            return card;
        });

        res.json(newCard);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Credit card already exists' });
        } else {
            res.status(500).json({ error: 'An error occurred. Please try again.' });
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Cash balance operations
app.post('/api/cash-balance', requireAuth, async (req, res) => {
    try {
        const { balance, initial_balance } = req.body;

        const cashRow = await withTransaction(pool, async (client) => {
            // Lock the existing record so concurrent saves can't both read the old values
            const existingCash = await client.query(
                'SELECT * FROM cash_balance WHERE user_id = $1 FOR UPDATE',
                [req.session.userId]
            );

            let result;

            if (existingCash.rows.length > 0) {
                const oldValues = {
                    balance: existingCash.rows[0].balance,
                    initial_balance: existingCash.rows[0].initial_balance
                };

                if (initial_balance !== undefined && balance !== undefined) {
                    // Full update from setup page - update both values
                    result = await client.query(
                        'UPDATE cash_balance SET balance = $1, initial_balance = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 RETURNING *',
                        [balance || 0, initial_balance || 0, req.session.userId]
                    );

                    await logActivity(
                        client,
                        req.session.userId,
                        'updated',
                        'cash_balance',
                        result.rows[0].id,
                        `Updated cash balance from ₹${parseFloat(oldValues.initial_balance).toFixed(2)} to ₹${parseFloat(initial_balance).toFixed(2)}`,
                        initial_balance,
                        oldValues,
                        { balance: balance, initial_balance: initial_balance }
                    );
                } else {
                    // Transaction update - only update balance, keep initial_balance unchanged
                    result = await client.query(
                        'UPDATE cash_balance SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *',
                        [balance || 0, req.session.userId]
                    );

                    await logActivity(
                        client,
                        req.session.userId,
                        'updated',
                        'cash_balance',
                        result.rows[0].id,
                        `Cash balance updated to ₹${parseFloat(balance).toFixed(2)}`,
                        balance,
                        oldValues,
                        { balance: balance, initial_balance: oldValues.initial_balance }
                    );
                }
            } else {
                // Insert new record - set both balance and initial_balance to the same value
                const initialValue = initial_balance !== undefined ? initial_balance : balance;
                result = await client.query(
                    'INSERT INTO cash_balance (user_id, balance, initial_balance) VALUES ($1, $2, $3) RETURNING *',
                    [req.session.userId, balance || 0, initialValue || 0]
                );

                await logActivity(
                    client,
                    req.session.userId,
                    'created',
                    'cash_balance',
                    result.rows[0].id,
                    `Set initial cash balance: ₹${parseFloat(initialValue).toFixed(2)}`,
                    initialValue
                );
            }

            return result.rows[0];
        });

        res.json(cashRow);
    } catch (error) {
        sendError(res, error);
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Bank CRUD operations
app.put('/api/banks/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, initialBalance } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Bank name is required' });
        }

        if (initialBalance === undefined || isNaN(initialBalance) || parseFloat(initialBalance) < 0) {
            return res.status(400).json({ error: 'Valid initial balance is required' });
        }

        // Every early exit inside rolls back (an early return used to leave the transaction
        // open on a pooled connection, leaking it to the next request)
        const bank = await withTransaction(pool, async (client) => {
            const currentBank = await client.query(
                'SELECT * FROM banks WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [id, req.session.userId]
            );

            if (currentBank.rows.length === 0) {
                throw new RequestError(404, 'Bank not found');
            }

            const oldBalance = parseFloat(currentBank.rows[0].initial_balance);
            const newBalance = parseFloat(initialBalance);
            const balanceDifference = newBalance - oldBalance;

            const result = await client.query(
                'UPDATE banks SET name = $1, initial_balance = $2, current_balance = current_balance + $3 WHERE id = $4 AND user_id = $5 RETURNING *',
                [name.trim(), newBalance, balanceDifference, id, req.session.userId]
            );
            return result.rows[0];
        });

        res.json(bank);
    } catch (error) {
        sendError(res, error);
    }
});

app.delete('/api/banks/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Every early exit inside rolls back (see PUT /api/banks/:id)
        await withTransaction(pool, async (client) => {
            const incomeCount = await client.query(
                'SELECT COUNT(*) FROM income_entries WHERE user_id = $1 AND credited_to_type = $2 AND credited_to_id = $3',
                [req.session.userId, 'bank', id]
            );
            const expenseCount = await client.query(
                'SELECT COUNT(*) FROM expenses WHERE user_id = $1 AND payment_method = $2 AND payment_source_id = $3',
                [req.session.userId, 'bank', id]
            );

            const totalTransactions = parseInt(incomeCount.rows[0].count) + parseInt(expenseCount.rows[0].count);
            if (totalTransactions > 0) {
                throw new RequestError(400, 'Cannot delete bank with existing transactions. Please delete all related transactions first.');
            }

            const result = await client.query(
                'DELETE FROM banks WHERE id = $1 AND user_id = $2 RETURNING *',
                [id, req.session.userId]
            );
            if (result.rows.length === 0) {
                throw new RequestError(404, 'Bank not found');
            }
        });

        res.json({ success: true, message: 'Bank deleted successfully' });
    } catch (error) {
        sendError(res, error);
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

app.delete('/api/credit-cards/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Every early exit inside rolls back, and the delete now runs inside the transaction
        // (it used to go through pool.query, outside it)
        await withTransaction(pool, async (client) => {
            const transactions = await client.query(
                'SELECT COUNT(*) FROM expenses WHERE user_id = $1 AND payment_method = $2 AND payment_source_id = $3',
                [req.session.userId, 'credit_card', id]
            );
            if (parseInt(transactions.rows[0].count) > 0) {
                throw new RequestError(400, 'Cannot delete credit card with existing transactions. Please delete all related transactions first.');
            }

            const result = await client.query(
                'DELETE FROM credit_cards WHERE id = $1 AND user_id = $2 RETURNING *',
                [id, req.session.userId]
            );
            if (result.rows.length === 0) {
                throw new RequestError(404, 'Credit card not found');
            }
        });

        res.json({ success: true, message: 'Credit card deleted successfully' });
    } catch (error) {
        sendError(res, error);
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

        const entry = entryDate(date);
        if (!entry) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const { month, year } = entry;

        // Entry, balance change and activity log commit together or not at all
        const income = await withTransaction(pool, async (client) => {
            const result = await client.query(
                'INSERT INTO income_entries (user_id, source, amount, credited_to_type, credited_to_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [
                    req.session.userId,
                    source,
                    amount,
                    creditedToType,
                    creditedToId,
                    entry.date,
                    month,
                    year,
                ]
            );

            if (creditedToType === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [amount, creditedToId, req.session.userId]
                );
            } else if (creditedToType === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance + $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            }

            await logActivity(
                client,
                req.session.userId,
                'created',
                'income',
                result.rows[0].id,
                `Added income: ${source}`,
                amount
            );

            return result.rows[0];
        });

        res.json(income);
    } catch (error) {
        sendError(res, error);
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
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

        const entry = entryDate(date);
        if (!entry) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const { month, year } = entry;

        // Balance check, entry, balance change and activity log commit together or not at all
        const expense = await withTransaction(pool, async (client) => {
            // Get user's tracking option to determine validation behavior
            const userResult = await client.query(
                'SELECT tracking_option FROM users WHERE id = $1',
                [req.session.userId]
            );

            const trackingOption = userResult.rows[0]?.tracking_option || 'both';

            // For expense-only users, allow expense tracking without strict balance validation
            // For 'both' or 'income' users, enforce balance validation
            const shouldValidateBalance = trackingOption !== 'expenses';

            if (shouldValidateBalance) {
                // Validate balance/limit only for users who also track income. Compared as numbers:
                // the stored balance is text, and text-to-text comparison went wrong for an amount
                // sent as a string ("1000.00" < "700" is true).
                // FOR UPDATE locks the row so concurrent expenses can't both pass the check.
                if (paymentMethod === 'bank') {
                    const bankResult = await client.query(
                        'SELECT current_balance FROM banks WHERE id = $1 AND user_id = $2 FOR UPDATE',
                        [paymentSourceId, req.session.userId]
                    );

                    if (
                        bankResult.rows.length === 0 ||
                        parseFloat(bankResult.rows[0].current_balance) < parseFloat(amount)
                    ) {
                        throw new RequestError(400, 'Insufficient bank balance');
                    }
                } else if (paymentMethod === 'cash') {
                    const cashResult = await client.query(
                        'SELECT balance FROM cash_balance WHERE user_id = $1 FOR UPDATE',
                        [req.session.userId]
                    );

                    if (
                        cashResult.rows.length === 0 ||
                        parseFloat(cashResult.rows[0].balance) < parseFloat(amount)
                    ) {
                        throw new RequestError(400, 'Insufficient cash balance');
                    }
                } else if (paymentMethod === 'credit_card') {
                    const ccResult = await client.query(
                        'SELECT credit_limit, used_limit FROM credit_cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
                        [paymentSourceId, req.session.userId]
                    );

                    if (
                        ccResult.rows.length === 0 ||
                        parseFloat(ccResult.rows[0].credit_limit) - parseFloat(ccResult.rows[0].used_limit) < parseFloat(amount)
                    ) {
                        throw new RequestError(400, 'Insufficient credit limit');
                    }
                }
            }

            const result = await client.query(
                'INSERT INTO expenses (user_id, title, amount, payment_method, payment_source_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [
                    req.session.userId,
                    title,
                    amount,
                    paymentMethod,
                    paymentSourceId,
                    entry.date,
                    month,
                    year,
                ]
            );

            // Balances always change, for every tracking option, so adding, editing and deleting
            // stay consistent (expenses-only users skip only the overspend check above)
            if (paymentMethod === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance - $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            } else if (paymentMethod === 'credit_card') {
                await client.query(
                    'UPDATE credit_cards SET used_limit = used_limit + $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            }

            await logActivity(
                client,
                req.session.userId,
                'created',
                'expense',
                result.rows[0].id,
                `Added expense: ${title}`,
                amount
            );

            return result.rows[0];
        });

        res.json(expense);
    } catch (error) {
        sendError(res, error);
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Update income transaction
app.put('/api/income/:id', requireAuth, async (req, res) => {
    try {
        const incomeId = req.params.id;
        const { source, amount, creditedToType, creditedToId, date } = req.body;
        const entry = entryDate(date);
        if (!entry) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const { month, year } = entry;

        // Reversal, update, re-application and activity log commit together or not at all
        await withTransaction(pool, async (client) => {
            // Lock the row so concurrent edits can't both reverse the same old amount
            const currentResult = await client.query(
                'SELECT * FROM income_entries WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [incomeId, req.session.userId]
            );

            if (currentResult.rows.length === 0) {
                throw new RequestError(404, 'Income transaction not found');
            }

            const currentIncome = currentResult.rows[0];

            // Reverse the previous transaction effect
            if (currentIncome.credited_to_type === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentIncome.amount, currentIncome.credited_to_id, req.session.userId]
                );
            } else if (currentIncome.credited_to_type === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance - $1 WHERE user_id = $2',
                    [currentIncome.amount, req.session.userId]
                );
            }

            // Update the income transaction
            await client.query(
                'UPDATE income_entries SET source = $1, amount = $2, credited_to_type = $3, credited_to_id = $4, date = $5, month = $6, year = $7 WHERE id = $8 AND user_id = $9',
                [source, amount, creditedToType, creditedToId, entry.date, month, year, incomeId, req.session.userId]
            );

            // Apply the new transaction effect
            if (creditedToType === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [amount, creditedToId, req.session.userId]
                );
            } else if (creditedToType === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance + $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            }

            await logActivity(
                client,
                req.session.userId,
                'updated',
                'income',
                incomeId,
                `Updated income: ${source}`,
                amount,
                {
                    source: currentIncome.source,
                    amount: currentIncome.amount,
                    credited_to_type: currentIncome.credited_to_type,
                    credited_to_id: currentIncome.credited_to_id
                },
                { source, amount, creditedToType, creditedToId }
            );
        });

        res.json({ success: true, message: 'Income transaction updated successfully' });
    } catch (error) {
        sendError(res, error);
    }
});

// Delete income transaction
app.delete('/api/income/:id', requireAuth, async (req, res) => {
    try {
        const incomeId = req.params.id;

        // Reversal, deletion and activity log commit together or not at all
        await withTransaction(pool, async (client) => {
            const currentResult = await client.query(
                'SELECT * FROM income_entries WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [incomeId, req.session.userId]
            );

            if (currentResult.rows.length === 0) {
                throw new RequestError(404, 'Income transaction not found');
            }

            const currentIncome = currentResult.rows[0];

            // Reverse the transaction effect
            if (currentIncome.credited_to_type === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [currentIncome.amount, currentIncome.credited_to_id, req.session.userId]
                );
            } else if (currentIncome.credited_to_type === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance - $1 WHERE user_id = $2',
                    [currentIncome.amount, req.session.userId]
                );
            }

            await client.query(
                'DELETE FROM income_entries WHERE id = $1 AND user_id = $2',
                [incomeId, req.session.userId]
            );

            await logActivity(
                client,
                req.session.userId,
                'deleted',
                'income',
                incomeId,
                `Deleted income: ${currentIncome.source}`,
                currentIncome.amount
            );
        });

        res.json({ success: true, message: 'Income transaction deleted successfully' });
    } catch (error) {
        sendError(res, error);
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
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Update expense transaction
app.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expenseId = req.params.id;
        const { title, amount, paymentMethod, paymentSourceId, date } = req.body;
        const entry = entryDate(date);
        if (!entry) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const { month, year } = entry;

        // Reversal, update, re-application and activity log commit together or not at all
        await withTransaction(pool, async (client) => {
            // Lock the row so concurrent edits can't both reverse the same old amount
            const currentResult = await client.query(
                'SELECT * FROM expenses WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [expenseId, req.session.userId]
            );

            if (currentResult.rows.length === 0) {
                throw new RequestError(404, 'Expense transaction not found');
            }

            const currentExpense = currentResult.rows[0];

            // Reverse the previous transaction effect
            if (currentExpense.payment_method === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'credit_card') {
                await client.query(
                    'UPDATE credit_cards SET used_limit = used_limit - $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance + $1 WHERE user_id = $2',
                    [currentExpense.amount, req.session.userId]
                );
            }

            // Update the expense transaction
            await client.query(
                'UPDATE expenses SET title = $1, amount = $2, payment_method = $3, payment_source_id = $4, date = $5, month = $6, year = $7 WHERE id = $8 AND user_id = $9',
                [title, amount, paymentMethod, paymentSourceId, entry.date, month, year, expenseId, req.session.userId]
            );

            // Apply the new transaction effect
            if (paymentMethod === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance - $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'credit_card') {
                await client.query(
                    'UPDATE credit_cards SET used_limit = used_limit + $1 WHERE id = $2 AND user_id = $3',
                    [amount, paymentSourceId, req.session.userId]
                );
            } else if (paymentMethod === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance - $1 WHERE user_id = $2',
                    [amount, req.session.userId]
                );
            }

            await logActivity(
                client,
                req.session.userId,
                'updated',
                'expense',
                expenseId,
                `Updated expense: ${title}`,
                amount,
                {
                    title: currentExpense.title,
                    amount: currentExpense.amount,
                    payment_method: currentExpense.payment_method,
                    payment_source_id: currentExpense.payment_source_id
                },
                { title, amount, paymentMethod, paymentSourceId }
            );
        });

        res.json({ success: true, message: 'Expense transaction updated successfully' });
    } catch (error) {
        sendError(res, error);
    }
});

// Delete expense transaction
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expenseId = req.params.id;

        // Reversal, deletion and activity log commit together or not at all
        await withTransaction(pool, async (client) => {
            const currentResult = await client.query(
                'SELECT * FROM expenses WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [expenseId, req.session.userId]
            );

            if (currentResult.rows.length === 0) {
                throw new RequestError(404, 'Expense transaction not found');
            }

            const currentExpense = currentResult.rows[0];

            // Reverse the transaction effect
            if (currentExpense.payment_method === 'bank') {
                await client.query(
                    'UPDATE banks SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'credit_card') {
                await client.query(
                    'UPDATE credit_cards SET used_limit = used_limit - $1 WHERE id = $2 AND user_id = $3',
                    [currentExpense.amount, currentExpense.payment_source_id, req.session.userId]
                );
            } else if (currentExpense.payment_method === 'cash') {
                await client.query(
                    'UPDATE cash_balance SET balance = balance + $1 WHERE user_id = $2',
                    [currentExpense.amount, req.session.userId]
                );
            }

            await client.query(
                'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
                [expenseId, req.session.userId]
            );

            await logActivity(
                client,
                req.session.userId,
                'deleted',
                'expense',
                expenseId,
                `Deleted expense: ${currentExpense.title}`,
                currentExpense.amount
            );
        });

        res.json({ success: true, message: 'Expense transaction deleted successfully' });
    } catch (error) {
        sendError(res, error);
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
        COALESCE(initial_balance, 0) as initial_balance,
        COALESCE(initial_balance, 0) +
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
        // No error details in the response: they stay in the server log
        res.status(500).json({ error: 'Failed to load monthly summary' });
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
        // Whole numbers only: a bad value used to reach the SQL as "LIMIT NaN" and fail with a 500
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNumber - 1) * pageSize;

        // Build WHERE conditions for filtering
        const whereConditions = [];
        const params = [userId];
        let paramCount = 1;

        // Handle month/year filtering
        if (month && year) {
            paramCount++;
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            whereConditions.push(`created_at >= $${paramCount}`);
            params.push(startDate);

            paramCount++;
            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
            whereConditions.push(`created_at < $${paramCount}`);
            params.push(endDate);
        } else if (year) {
            paramCount++;
            whereConditions.push(`created_at >= $${paramCount}`);
            params.push(`${year}-01-01`);

            paramCount++;
            whereConditions.push(`created_at < $${paramCount}`);
            params.push(`${parseInt(year) + 1}-01-01`);
        } else {
            // Handle date range filtering
            if (from_date) {
                paramCount++;
                whereConditions.push(`created_at >= $${paramCount}`);
                params.push(from_date);
            }

            if (to_date) {
                paramCount++;
                whereConditions.push(`created_at <= $${paramCount}`);
                params.push(to_date);
            }
        }

        // Enhanced activities query using the activity_log table. Account names are looked up only
        // among the user's own accounts: entries carry client-sent ids
        let activitiesQuery = `
            SELECT
                entity_type as activity_type,
                entity_id as id,
                description,
                amount,
                CASE
                    WHEN entity_type = 'cash_balance' THEN 'Cash'
                    WHEN entity_type = 'bank' THEN 
                        COALESCE((SELECT name FROM banks WHERE id = entity_id AND user_id = activity_log.user_id), 'Bank')
                    WHEN entity_type = 'credit_card' THEN 
                        COALESCE((SELECT name FROM credit_cards WHERE id = entity_id AND user_id = activity_log.user_id), 'Credit Card')
                    WHEN entity_type = 'income' AND new_values->>'creditedToType' = 'bank' THEN 
                        COALESCE((SELECT name FROM banks WHERE id = (new_values->>'creditedToId')::int AND user_id = activity_log.user_id), 'Bank')
                    WHEN entity_type = 'income' AND new_values->>'creditedToType' = 'cash' THEN 'Cash'
                    WHEN entity_type = 'expense' AND (new_values->>'paymentMethod' = 'bank' OR old_values->>'payment_method' = 'bank') THEN 
                        COALESCE(
                            (SELECT name FROM banks WHERE id = (new_values->>'paymentSourceId')::int AND user_id = activity_log.user_id),
                            (SELECT name FROM banks WHERE id = (old_values->>'payment_source_id')::int AND user_id = activity_log.user_id),
                            'Bank'
                        )
                    WHEN entity_type = 'expense' AND (new_values->>'paymentMethod' = 'credit_card' OR old_values->>'payment_method' = 'credit_card') THEN 
                        COALESCE(
                            (SELECT name FROM credit_cards WHERE id = (new_values->>'paymentSourceId')::int AND user_id = activity_log.user_id),
                            (SELECT name FROM credit_cards WHERE id = (old_values->>'payment_source_id')::int AND user_id = activity_log.user_id),
                            'Credit Card'
                        )
                    WHEN entity_type = 'expense' AND (new_values->>'paymentMethod' = 'cash' OR old_values->>'payment_method' = 'cash') THEN 'Cash'
                    ELSE 'System'
                END as account_info,
                created_at as activity_date,
                action_type,
                old_values,
                new_values
            FROM activity_log
            WHERE user_id = $1
        `;

        // Apply filtering
        if (whereConditions.length > 0) {
            activitiesQuery += ` AND ${whereConditions.join(' AND ')}`;
        }

        // Apply type filtering if specified
        if (type && type !== '') {
            paramCount++;
            whereConditions.push(`entity_type = $${paramCount}`);
            activitiesQuery += ` AND entity_type = $${paramCount}`;
            params.push(type);
        }
        // The same filters, for the page count (the count used to ignore them)
        const filterSql = whereConditions.length > 0 ? ` AND ${whereConditions.join(' AND ')}` : '';
        const filterParams = [...params];

        activitiesQuery += ' ORDER BY created_at DESC';

        // For CSV export, don't limit results
        if (!exportCsv) {
            activitiesQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;
        }

        const activitiesResult = await pool.query(activitiesQuery, params);

        // Get count for pagination
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM activity_log WHERE user_id = $1${filterSql}`,
            filterParams
        );
        const totalItems = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalItems / pageSize);

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
                return [date, activity.activity_type, activity.description, amount, activity.account_info || ''].map(csvField).join(',');
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
            currentPage: pageNumber,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: pageSize
        });

    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel runs the exported Express app as a function, so the app must be the default export.
// `app` and `pool` are also attached so `const { app, pool } = require('./server')` keeps working in tests.
module.exports = app;
module.exports.app = app;
module.exports.pool = pool;

// Cleanup function for tests
function cleanup() {
    return pool.end();
}

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
    console.log('Starting Express server...');
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        console.log('BalanceTrack is ready!');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down gracefully...');
        server.close(() => {
            console.log('HTTP server closed');
            cleanup().then(() => {
                console.log('Database connections closed');
                process.exit(0);
            });
        });
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down gracefully...');
        server.close(() => {
            console.log('HTTP server closed');
            cleanup().then(() => {
                console.log('Database connections closed');
                process.exit(0);
            });
        });
    });
}

module.exports.cleanup = cleanup;
