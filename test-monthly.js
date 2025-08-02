// Test monthly summary with a logged in user session
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker',
    password: process.env.DB_PASSWORD || 'expense-tracker-2025',
    port: process.env.DB_PORT || 5432,
});

async function testMonthlySummaryQueries() {
    const client = await pool.connect();

    try {
        console.log('🧪 Testing monthly summary queries...');
        
        const userId = 1;
        const selectedMonth = 8;
        const selectedYear = 2025;
        const endOfSelectedMonth = new Date(selectedYear, selectedMonth, 0);
        
        console.log('📅 Testing for:', { userId, selectedMonth, selectedYear, endOfSelectedMonth });

        // Test user query
        console.log('\n1️⃣ Testing user query...');
        try {
            const userResult = await client.query(
                'SELECT created_at, COALESCE(tracking_option, \'both\') as tracking_option FROM users WHERE id = $1',
                [userId]
            );
            console.log('✅ User query result:', userResult.rows[0]);
        } catch (error) {
            console.log('❌ User query failed:', error.message);
            // Try fallback
            const userResult = await client.query(
                'SELECT created_at, \'both\' as tracking_option FROM users WHERE id = $1',
                [userId]
            );
            console.log('✅ User fallback query result:', userResult.rows[0]);
        }

        // Test income query
        console.log('\n2️⃣ Testing income query...');
        const incomeResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) as total_income FROM income_entries WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3',
            [userId, selectedMonth, selectedYear]
        );
        console.log('✅ Income result:', incomeResult.rows[0]);

        // Test expense query
        console.log('\n3️⃣ Testing expense query...');
        const expenseResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3',
            [userId, selectedMonth, selectedYear]
        );
        console.log('✅ Expense result:', expenseResult.rows[0]);

        // Test bank query
        console.log('\n4️⃣ Testing bank query...');
        const bankResult = await client.query(
            `SELECT b.id, b.name, b.initial_balance,
                b.initial_balance + 
                COALESCE((SELECT SUM(amount) FROM income_entries WHERE user_id = $1 AND credited_to_type = 'bank' AND credited_to_id = b.id AND date <= $2), 0) - 
                COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND payment_method = 'bank' AND payment_source_id = b.id AND date <= $2), 0) as balance_at_month_end
             FROM banks b WHERE b.user_id = $1 AND b.created_at <= $2`,
            [userId, endOfSelectedMonth]
        );
        console.log('✅ Bank result:', bankResult.rows);

        // Test cash query
        console.log('\n5️⃣ Testing cash query...');
        const cashResult = await client.query(
            `SELECT COALESCE(balance, 0) as initial_balance,
                COALESCE(balance, 0) + 
                COALESCE((SELECT SUM(amount) FROM income_entries WHERE user_id = $1 AND credited_to_type = 'cash' AND date <= $2), 0) - 
                COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND payment_method = 'cash' AND date <= $2), 0) as cash_balance_at_month_end
             FROM cash_balance WHERE user_id = $1`,
            [userId, endOfSelectedMonth]
        );
        console.log('✅ Cash result:', cashResult.rows);
        
        if (cashResult.rows.length === 0) {
            console.log('⚠️  No cash balance record found, using defaults');
        }

        console.log('\n🎉 All queries successful!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
    } finally {
        client.release();
        await pool.end();
    }
}

testMonthlySummaryQueries()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
