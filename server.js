// Add this to the top of both server.js and setup-db.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'expense_tracker',
  password: process.env.DB_PASSWORD || 'expense-tracker-2025',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(400).json({ error: 'Registration failed. Please try again.' });
    }
  }
});

// User Login
app.post('/api/login', async (req, res) => {
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

// Password Reset - Step 1: Verify user and security question
app.post('/api/forgot-password', async (req, res) => {
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
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Password Reset - Step 2: Verify security answer and reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { userId, securityAnswer, newPassword } = req.body;
    
    if (!userId || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
    console.error('Reset password error:', error);
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
    let params = [req.session.userId];
    
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
    
    // Validate balance/limit
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
    
    const result = await pool.query(
      'INSERT INTO expenses (user_id, title, amount, payment_method, payment_source_id, date, month, year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.session.userId, title, amount, paymentMethod, paymentSourceId, date, month, year]
    );
    
    // Update balance/limit
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
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/expenses', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = 'SELECT * FROM expenses WHERE user_id = $1';
    let params = [req.session.userId];
    
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

    // Get income for the month
    const incomeResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as month_income FROM income_entries WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.session.userId, month, year]
    );

    // Get total bank balances
    const bankResult = await pool.query(
      'SELECT COALESCE(SUM(current_balance), 0) as total_bank_balance, COALESCE(SUM(initial_balance), 0) as total_initial_balance FROM banks WHERE user_id = $1',
      [req.session.userId]
    );

    // Get cash balance
    const cashResult = await pool.query(
      'SELECT COALESCE(balance, 0) as cash_balance, COALESCE(initial_balance, 0) as initial_cash_balance FROM cash_balance WHERE user_id = $1',
      [req.session.userId]
    );

    // Calculate income and balances correctly
    const monthIncome = parseFloat(incomeResult.rows[0]?.month_income) || 0;
    const totalBankBalance = parseFloat(bankResult.rows[0]?.total_bank_balance) || 0;
    const totalInitialBankBalance = parseFloat(bankResult.rows[0]?.total_initial_balance) || 0;
    const cashBalance = parseFloat(cashResult.rows[0]?.cash_balance) || 0;
    const initialCashBalance = parseFloat(cashResult.rows[0]?.initial_cash_balance) || 0;

    // Log for debugging
    console.log('Cash data:', cashResult.rows[0]);
    console.log('Parsed cash balance:', cashBalance);
    console.log('Parsed initial cash balance:', initialCashBalance);

    // Total current wealth = Current Bank Balance + Cash Balance (these already reflect all historical transactions)
    const totalCurrentWealth = totalBankBalance + cashBalance;
    
    // Total initial balances
    const totalInitialBalance = totalInitialBankBalance + initialCashBalance;

    // Get expenses for the month - Fixed table name from expense_entries to expenses
    const expenseResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.session.userId, month, year]
    );

    const monthExpenses = parseFloat(expenseResult.rows[0]?.total_expenses) || 0;

    // Get other account details
    const banks = await pool.query('SELECT * FROM banks WHERE user_id = $1', [req.session.userId]);
    const creditCards = await pool.query('SELECT * FROM credit_cards WHERE user_id = $1', [req.session.userId]);

    // Calculate net savings as initial balance + income - expenses
    const netSavings = totalInitialBalance + monthIncome - monthExpenses;

    res.json({
      monthlyIncome: monthIncome, // Income for just this month
      totalCurrentWealth: totalCurrentWealth, // Current total wealth (bank + cash balances)
      totalExpenses: monthExpenses, // Expenses for just this month
      netSavings: netSavings, // Initial balance + income - expenses
      totalInitialBalance: totalInitialBalance, // Total initial balances for reference
      banks: banks.rows,
      creditCards: creditCards.rows,
      cash: {
        balance: cashResult.rows[0]?.cash_balance || 0,
        initial_balance: cashResult.rows[0]?.initial_cash_balance || 0
      }
    });
  } catch (error) {
    console.error('Error in monthly-summary endpoint:', error);
    res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});