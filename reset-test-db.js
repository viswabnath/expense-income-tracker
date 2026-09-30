#!/usr/bin/env node

/**
 * Test Database Reset Script
 * Clears all test data and resets database to clean state for testing
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetTestDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('Starting test database reset...');

        // Begin transaction
        await client.query('BEGIN');

        // Delete all data in the correct order (respecting foreign key constraints)
        console.log('Clearing activity logs...');
        await client.query('DELETE FROM activity_log');

        console.log('Clearing expenses...');
        await client.query('DELETE FROM expenses');

        console.log('Clearing income entries...');
        await client.query('DELETE FROM income_entries');

        console.log('Clearing cash balances...');
        await client.query('DELETE FROM cash_balance');

        console.log('Clearing credit cards...');
        await client.query('DELETE FROM credit_cards');

        console.log('Clearing banks...');
        await client.query('DELETE FROM banks');

        console.log('Clearing users...');
        await client.query('DELETE FROM users');

        // Reset sequences to start from 1
        console.log('Resetting sequences...');
        await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE banks_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE credit_cards_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE income_entries_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE expenses_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE cash_balance_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE activity_log_id_seq RESTART WITH 1');

        // Commit transaction
        await client.query('COMMIT');

        // Verify cleanup
        console.log('Verifying cleanup...');
        const counts = await Promise.all([
            client.query('SELECT COUNT(*) FROM users'),
            client.query('SELECT COUNT(*) FROM banks'),
            client.query('SELECT COUNT(*) FROM credit_cards'),
            client.query('SELECT COUNT(*) FROM income_entries'),
            client.query('SELECT COUNT(*) FROM expenses'),
            client.query('SELECT COUNT(*) FROM cash_balance'),
            client.query('SELECT COUNT(*) FROM activity_log')
        ]);

        const [users, banks, creditCards, income, expenses, cash, activities] = counts.map(
            result => parseInt(result.rows[0].count)
        );

        console.log('Final counts:');
        console.log(`  Users: ${users}`);
        console.log(`  Banks: ${banks}`);
        console.log(`  Credit Cards: ${creditCards}`);
        console.log(`  Income Entries: ${income}`);
        console.log(`  Expenses: ${expenses}`);
        console.log(`  Cash Balances: ${cash}`);
        console.log(`  Activity Logs: ${activities}`);

        if (users + banks + creditCards + income + expenses + cash + activities === 0) {
            console.log('Database successfully reset to clean state!');
        } else {
            console.log('Warning: Some data may remain in the database');
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error resetting database:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Create a test user for integration tests
async function createTestUser() {
    const client = await pool.connect();
    
    try {
        console.log('Creating test user...');
        
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('TestPass123&', 10);
        const hashedSecurityAnswer = await bcrypt.hash('fluffy', 10);

        const result = await client.query(
            `INSERT INTO users (username, password_hash, name, email, security_question, security_answer_hash, tracking_option) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                'testuser',
                hashedPassword,
                'Test User',
                'test@example.com',
                'What is your pet name?',
                hashedSecurityAnswer,
                'both'
            ]
        );

        console.log(`Test user created with ID: ${result.rows[0].id}`);
        return result.rows[0].id;

    } catch (error) {
        console.error('Error creating test user:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Main function
async function main() {
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        const createUser = args.includes('--with-user') || args.includes('-u');
        const skipConfirmation = args.includes('--yes') || args.includes('-y');

        if (!skipConfirmation && process.env.NODE_ENV === 'production') {
            console.log('WARNING: You are about to reset the PRODUCTION database!');
            console.log('This will delete ALL data permanently.');
            console.log('Use --yes flag if you really want to proceed.');
            process.exit(1);
        }

        // Test database connection
        const client = await pool.connect();
        console.log('Database connection successful');
        client.release();

        // Reset database
        await resetTestDatabase();

        // Optionally create test user
        if (createUser) {
            await createTestUser();
        }

        console.log('\nTest database reset completed successfully!');
        
        if (!createUser) {
            console.log('\nTip: Use --with-user flag to create a test user automatically');
        }

    } catch (error) {
        console.error('\nFailed to reset test database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Show help
function showHelp() {
    console.log(`
Test Database Reset Script

Usage:
  node reset-test-db.js [options]

Options:
  --with-user, -u    Create a test user after reset
  --yes, -y          Skip confirmation (dangerous in production)
  --help, -h         Show this help message

Examples:
  node reset-test-db.js                 # Reset database only
  node reset-test-db.js --with-user     # Reset and create test user
  node reset-test-db.js -u -y           # Reset, create user, skip confirmation

Environment Variables:
  DB_USER            Database username (default: postgres)
  DB_HOST            Database host (default: localhost)
  DB_NAME            Database name (default: expense_tracker)
  DB_PASSWORD        Database password
  DB_PORT            Database port (default: 5432)
`);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run main function
if (require.main === module) {
    main();
}

module.exports = { resetTestDatabase, createTestUser };
