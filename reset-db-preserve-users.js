// Database Reset Script - Preserves users table, resets all other data
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
});

async function resetDatabasePreserveUsers() {
    const client = await pool.connect();

    try {
        console.log('🗑️  Resetting database while preserving users...');

        // First, let's backup users and their tracking options
        console.log('📋 Backing up user data...');
        const usersBackup = await client.query('SELECT * FROM users');
        console.log(`✅ Backed up ${usersBackup.rows.length} users`);

        // Clear all data from existing tables and reset sequences
        console.log('🧹 Clearing all financial data (if tables exist)...');

        // Helper function to safely delete from table if it exists
        const safeDelete = async (tableName) => {
            try {
                const checkTable = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [tableName]);

                if (checkTable.rows[0].exists) {
                    await client.query(`DELETE FROM ${tableName}`);
                    console.log(`✅ Cleared data from ${tableName}`);
                } else {
                    console.log(`⚠️  Table ${tableName} does not exist, skipping...`);
                }
            } catch (error) {
                console.log(`⚠️  Could not clear ${tableName}: ${error.message}`);
            }
        };

        // Clear data from existing tables
        await safeDelete('transactions');
        await safeDelete('expenses');
        await safeDelete('income_entries');
        await safeDelete('credit_cards');
        await safeDelete('banks');
        await safeDelete('cash_balance');
        await safeDelete('session');

        // Drop all tables except users (in reverse order due to foreign key constraints)
        console.log('🗑️  Dropping financial data tables...');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE');
        await client.query('DROP TABLE IF EXISTS expenses CASCADE');
        await client.query('DROP TABLE IF EXISTS income_entries CASCADE');
        await client.query('DROP TABLE IF EXISTS password_reset_tokens CASCADE');
        await client.query('DROP TABLE IF EXISTS credit_cards CASCADE');
        await client.query('DROP TABLE IF EXISTS banks CASCADE');
        await client.query('DROP TABLE IF EXISTS cash_balance CASCADE');

        console.log('✅ Financial data tables dropped successfully');
        console.log('🔨 Recreating fresh financial tables...');

        // Create banks table
        await client.query(`
            CREATE TABLE banks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                initial_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
                current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Banks table created');

        // Create credit_cards table
        await client.query(`
            CREATE TABLE credit_cards (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                credit_limit DECIMAL(15, 2) NOT NULL,
                used_limit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Credit cards table created');

        // Create cash_balance table
        await client.query(`
            CREATE TABLE cash_balance (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Cash balance table created');

        // Create income_entries table
        await client.query(`
            CREATE TABLE income_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                source VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                credited_to_type VARCHAR(20) NOT NULL CHECK (credited_to_type IN ('cash', 'bank')),
                credited_to_id INTEGER,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Income entries table created');

        // Create expenses table
        await client.query(`
            CREATE TABLE expenses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                payment_method_type VARCHAR(20) NOT NULL CHECK (payment_method_type IN ('cash', 'bank', 'credit_card')),
                payment_method_id INTEGER,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Expenses table created');

        // Create password_reset_tokens table
        await client.query(`
            CREATE TABLE password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Password reset tokens table created');

        // Create transactions table (for activity tracking)
        await client.query(`
            CREATE TABLE transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'setup')),
                description TEXT,
                amount DECIMAL(15, 2),
                account_type VARCHAR(20),
                account_id INTEGER,
                account_name VARCHAR(100),
                date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Transactions table created');

        // Create indexes for better performance
        console.log('📊 Creating indexes...');
        await client.query('CREATE INDEX idx_banks_user_id ON banks(user_id)');
        await client.query('CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id)');
        await client.query('CREATE INDEX idx_cash_balance_user_id ON cash_balance(user_id)');
        await client.query('CREATE INDEX idx_income_entries_user_id ON income_entries(user_id)');
        await client.query('CREATE INDEX idx_income_entries_date ON income_entries(date)');
        await client.query('CREATE INDEX idx_expenses_user_id ON expenses(user_id)');
        await client.query('CREATE INDEX idx_expenses_date ON expenses(date)');
        await client.query('CREATE INDEX idx_transactions_user_id ON transactions(user_id)');
        await client.query('CREATE INDEX idx_transactions_date ON transactions(date)');
        await client.query('CREATE INDEX idx_transactions_type ON transactions(type)');
        console.log('✅ Indexes created');

        // Reset all sequences to start from 1
        console.log('🔄 Resetting ID sequences to start from 1...');

        // Helper function to safely reset sequence if it exists
        const safeResetSequence = async (sequenceName) => {
            try {
                await client.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
                console.log(`✅ Reset ${sequenceName} to start from 1`);
            } catch (error) {
                console.log(`⚠️  Could not reset ${sequenceName}: ${error.message}`);
            }
        };

        await safeResetSequence('banks_id_seq');
        await safeResetSequence('credit_cards_id_seq');
        await safeResetSequence('cash_balance_id_seq');
        await safeResetSequence('income_entries_id_seq');
        await safeResetSequence('expenses_id_seq');
        await safeResetSequence('transactions_id_seq');
        await safeResetSequence('password_reset_tokens_id_seq');
        console.log('✅ All sequences reset to start from 1');

        console.log('🎉 Database reset completed successfully!');
        console.log(`👥 ${usersBackup.rows.length} users preserved`);
        console.log('💰 All financial data cleared - you can start fresh!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Login with your existing account');
        console.log('2. Set up your banks and credit cards');
        console.log('3. Set your cash balance');
        console.log('4. Start tracking your income and expenses');

    } catch (error) {
        console.error('❌ Error resetting database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the reset
resetDatabasePreserveUsers()
    .then(() => {
        console.log('✅ Database reset process completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Database reset failed:', error);
        process.exit(1);
    });
