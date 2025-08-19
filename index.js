// Simple redirect to server.js for deployment compatibility
// Render deployment entry point

// Debug environment variables
console.log('🔧 Starting BalanceTrack application...');
console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DB_HOST:', process.env.DB_HOST ? '✅ Set' : '❌ Not set');
console.log('- DB_NAME:', process.env.DB_NAME ? '✅ Set' : '❌ Not set');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Not set');

// If critical env vars are missing, show helpful message
if (!process.env.DB_HOST || !process.env.SESSION_SECRET) {
    console.log('');
    console.log('❌ Critical environment variables missing!');
    console.log('📋 Please add these in Render dashboard → Environment:');
    console.log('   SESSION_SECRET=your_64_char_secret_key');
    console.log('   DB_HOST=your_postgres_host');
    console.log('   DB_NAME=expense_tracker');
    console.log('   DB_USER=postgres');
    console.log('   DB_PASSWORD=your_db_password');
    console.log('   DB_SSL=true');
    console.log('');
}

require('./server.js');
