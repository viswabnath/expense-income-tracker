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

require('./server.js');
