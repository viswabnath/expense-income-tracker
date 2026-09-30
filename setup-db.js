require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// Database connection configuration using environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
    // SSL for cloud providers; same rule as server.js
    ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    // Optional Postgres schema (e.g. balancetrack_test for tests); defaults to public
    ...(process.env.DB_SCHEMA && { options: `-c search_path=${process.env.DB_SCHEMA}` })
});

// Database schema setup
const createTables = async () => {
    try {
        // Create the target schema first when one is configured
        if (process.env.DB_SCHEMA) {
            if (!/^[a-z_][a-z0-9_]*$/.test(process.env.DB_SCHEMA)) {
                throw new Error(`Invalid DB_SCHEMA: ${process.env.DB_SCHEMA}`);
            }
            await pool.query(`CREATE SCHEMA IF NOT EXISTS ${process.env.DB_SCHEMA}`);
            console.log(`Using schema: ${process.env.DB_SCHEMA}`);
        }

        // Users table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        security_question VARCHAR(100) NOT NULL,
        security_answer_hash VARCHAR(255) NOT NULL,
        tracking_option VARCHAR(20) NOT NULL CHECK (tracking_option IN ('income', 'expenses', 'both')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Banks table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        initial_balance DECIMAL(20,2) DEFAULT 0.00,
        current_balance DECIMAL(20,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `);

        // Credit cards table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_cards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        credit_limit DECIMAL(20,2) NOT NULL,
        used_limit DECIMAL(20,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `);

        // Income entries table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS income_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source VARCHAR(100) NOT NULL,
        amount DECIMAL(20,2) NOT NULL,
        credited_to_type VARCHAR(10) NOT NULL CHECK (credited_to_type IN ('bank', 'cash')),
        credited_to_id INTEGER,
        date DATE NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Expenses table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        amount DECIMAL(20,2) NOT NULL,
        payment_method VARCHAR(15) NOT NULL CHECK (payment_method IN ('cash', 'bank', 'credit_card')),
        payment_source_id INTEGER,
        date DATE NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Cash balance table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_balance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance DECIMAL(20,2) DEFAULT 0.00,
        initial_balance DECIMAL(20,2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Activity log table for tracking all user activities
        await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(20,2),
        old_values JSONB,
        new_values JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Add migration for existing users table to include new columns
        console.log('Adding new columns to existing users table');
        try {
            await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS security_question VARCHAR(100),
        ADD COLUMN IF NOT EXISTS security_answer_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);

            // Add unique constraint on email if it doesn't exist
            await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'users_email_key'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
          END IF;
        END $$;
      `);
            console.log('User table migration completed successfully!');
        } catch (migrationError) {
            // Migration note: error occurred during user table migration
            console.error('Migration note:', migrationError);
        }

        // Session store table (same definition connect-pg-simple creates)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);
    `);

        // Indexes for the per-user queries every page makes
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_banks_user ON banks (user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards (user_id);
      CREATE INDEX IF NOT EXISTS idx_income_user_period ON income_entries (user_id, year, month);
      CREATE INDEX IF NOT EXISTS idx_expenses_user_period ON expenses (user_id, year, month);
      CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity_log (user_id, created_at DESC);
    `);

        // Supabase exposes tables through its Data API. Row level security with no policies
        // blocks that access; the app connects as the table owner, which RLS does not restrict.
        await pool.query(`
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
      ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
      ALTER TABLE cash_balance ENABLE ROW LEVEL SECURITY;
      ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
      ALTER TABLE session ENABLE ROW LEVEL SECURITY;
    `);

        console.log('Database tables created successfully!');
    } catch (error) {
        console.error('Error creating tables:', error);
        // Exit non-zero so a failed migration is visible to scripts and CI
        process.exitCode = 1;
    } finally {
        pool.end();
    }
};

// Run the setup
createTables();
