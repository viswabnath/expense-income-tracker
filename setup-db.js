
// Add this to the top of both server.js and setup-db.js
require('dotenv').config();
const { Pool } = require('pg');

// Database connection configuration using environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
    // For production SSL connection (required by most cloud providers)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database schema setup
const createTables = async () => {
    try {
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
        initial_balance DECIMAL(10,2) DEFAULT 0.00,
        current_balance DECIMAL(10,2) DEFAULT 0.00,
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
        credit_limit DECIMAL(10,2) NOT NULL,
        used_limit DECIMAL(10,2) DEFAULT 0.00,
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
        amount DECIMAL(10,2) NOT NULL,
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
        amount DECIMAL(10,2) NOT NULL,
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
        balance DECIMAL(10,2) DEFAULT 0.00,
        initial_balance DECIMAL(10,2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Add migration for existing users table to include new columns
        console.log('Adding new columns to existing users table if they don\'t exist...');

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
            console.log('Migration note:', migrationError.message);
        }

        console.log('Database tables created successfully!');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        pool.end();
    }
};

// Run the setup
createTables();
