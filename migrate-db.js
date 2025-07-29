require('dotenv').config();
const { Pool } = require('pg');

// Database connection configuration using environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrateTables = async () => {
    try {
        // Update banks table columns
        await pool.query(`
            ALTER TABLE banks 
            ALTER COLUMN initial_balance TYPE DECIMAL(20,2),
            ALTER COLUMN current_balance TYPE DECIMAL(20,2)
        `);

        // Update credit_cards table columns
        await pool.query(`
            ALTER TABLE credit_cards 
            ALTER COLUMN credit_limit TYPE DECIMAL(20,2),
            ALTER COLUMN used_limit TYPE DECIMAL(20,2)
        `);

        // Update income_entries table columns
        await pool.query(`
            ALTER TABLE income_entries 
            ALTER COLUMN amount TYPE DECIMAL(20,2)
        `);

        // Update expenses table columns
        await pool.query(`
            ALTER TABLE expenses 
            ALTER COLUMN amount TYPE DECIMAL(20,2)
        `);

        // Update cash_balance table columns
        await pool.query(`
            ALTER TABLE cash_balance 
            ALTER COLUMN balance TYPE DECIMAL(20,2),
            ALTER COLUMN initial_balance TYPE DECIMAL(20,2)
        `);
    } catch {
        // intentionally empty: ignore migration errors
    } finally {
        pool.end();
    }
};

migrateTables();

