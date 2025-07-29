const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway provides this
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  // fallback for local dev:
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  database: process.env.DB_DATABASE || 'expense_tracker'
});

module.exports = pool;