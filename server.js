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
  user: 'postgres',
  host: 'localhost',
  database: 'expense_tracker',
  password: 'your_password',
  port: 5432,
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
    const { username, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, name, tracking_option) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashedPassword, name, 'both']
    );
    
    req.session.userId = result.rows[0].id;
    res.json({ success: true, userId: result.rows[0].id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
    
    const result = await pool.query(
      'INSERT INTO cash_balance (user_id, balance, initial_balance) VALUES ($1, $2, $2) ON CONFLICT (user_id) DO UPDATE SET balance = $2, initial_balance = $2 RETURNING *',
      [req.session.userId, balance || 0]
    );
    
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

    // Calculate total income including all balances
    const monthIncome = parseFloat(incomeResult.rows[0].month_income);
    const totalBankBalance = parseFloat(bankResult.rows[0].total_bank_balance);
    const cashBalance = parseFloat(cashResult.rows[0]?.cash_balance || 0);

    // Total income = Monthly Income + Total Bank Balance + Cash Balance
    const totalIncome = monthIncome + totalBankBalance + cashBalance;

    // Get expenses for the month
    const expenseResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expense_entries WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.session.userId, month, year]
    );

    // Get other account details
    const banks = await pool.query('SELECT * FROM banks WHERE user_id = $1', [req.session.userId]);
    const creditCards = await pool.query('SELECT * FROM credit_cards WHERE user_id = $1', [req.session.userId]);

    res.json({
      monthlyIncome: monthIncome, // Income for just this month
      totalIncome: totalIncome, // Total including all balances
      totalExpenses: parseFloat(expenseResult.rows[0].total_expenses),
      netSavings: totalIncome - parseFloat(expenseResult.rows[0].total_expenses),
      banks: banks.rows,
      creditCards: creditCards.rows,
      cash: cashResult.rows[0] || { balance: 0 }
    });
  } catch (error) {
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