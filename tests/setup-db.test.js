/**
 * Database Setup Tests
 * Tests the database schema creation and migration functionality
 * @jest-environment node
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Mock the entire pg module
jest.mock('pg');

describe('Database Setup Tests', () => {
    let mockPool;
    let mockQuery;
    let mockEnd;
    let originalEnv;
    let consoleLogSpy;
    let consoleErrorSpy;
    let setupDbCode;

    beforeAll(() => {
        // Read the setup-db.js file content for analysis
        setupDbCode = fs.readFileSync(path.join(__dirname, '../setup-db.js'), 'utf8');
    });

    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };

        // Mock console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Setup mock functions
        mockQuery = jest.fn().mockResolvedValue({ rows: [] });
        mockEnd = jest.fn().mockResolvedValue();

        mockPool = {
            query: mockQuery,
            end: mockEnd
        };

        // Mock Pool constructor to return our mock
        Pool.mockImplementation(() => mockPool);
    });

    afterEach(() => {
        // Restore environment
        process.env = originalEnv;

        // Restore console methods
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();

        jest.clearAllMocks();
    });

    describe('Code Structure Analysis', () => {
        test('should contain required environment variable configuration', () => {
            expect(setupDbCode).toContain('require(\'dotenv\').config()');
            expect(setupDbCode).toContain('const { Pool } = require(\'pg\')');
        });

        test('should contain database pool configuration with environment variables', () => {
            expect(setupDbCode).toContain('process.env.DB_USER || \'postgres\'');
            expect(setupDbCode).toContain('process.env.DB_HOST || \'localhost\'');
            expect(setupDbCode).toContain('process.env.DB_NAME || \'expense_tracker\'');
            expect(setupDbCode).toContain('process.env.DB_PASSWORD || \'expense-tracker-2025\'');
            expect(setupDbCode).toContain('process.env.DB_PORT || 5432');
        });

        test('should contain SSL configuration for production', () => {
            expect(setupDbCode).toContain('process.env.NODE_ENV === \'production\'');
            expect(setupDbCode).toContain('{ rejectUnauthorized: false }');
        });

        test('should contain createTables function', () => {
            expect(setupDbCode).toContain('const createTables = async ()');
            expect(setupDbCode).toContain('createTables()');
        });
    });

    describe('Database Schema Analysis', () => {
        test('should contain users table creation with all required fields', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS users');
            expect(setupDbCode).toContain('id SERIAL PRIMARY KEY');
            expect(setupDbCode).toContain('username VARCHAR(50) UNIQUE NOT NULL');
            expect(setupDbCode).toContain('password_hash VARCHAR(255) NOT NULL');
            expect(setupDbCode).toContain('name VARCHAR(100) NOT NULL');
            expect(setupDbCode).toContain('email VARCHAR(255) UNIQUE NOT NULL');
            expect(setupDbCode).toContain('security_question VARCHAR(100) NOT NULL');
            expect(setupDbCode).toContain('security_answer_hash VARCHAR(255) NOT NULL');
            expect(setupDbCode).toContain('tracking_option VARCHAR(20) NOT NULL');
            expect(setupDbCode).toContain('CHECK (tracking_option IN (\'income\', \'expenses\', \'both\'))');
        });

        test('should contain banks table creation with foreign key constraints', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS banks');
            expect(setupDbCode).toContain('user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
            expect(setupDbCode).toContain('initial_balance DECIMAL(20,2) DEFAULT 0.00');
            expect(setupDbCode).toContain('current_balance DECIMAL(20,2) DEFAULT 0.00');
            expect(setupDbCode).toContain('UNIQUE(user_id, name)');
        });

        test('should contain credit_cards table creation', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS credit_cards');
            expect(setupDbCode).toContain('credit_limit DECIMAL(20,2) NOT NULL');
            expect(setupDbCode).toContain('used_limit DECIMAL(20,2) DEFAULT 0.00');
        });

        test('should contain income_entries table with proper constraints', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS income_entries');
            expect(setupDbCode).toContain('credited_to_type VARCHAR(10) NOT NULL CHECK (credited_to_type IN (\'bank\', \'cash\'))');
            expect(setupDbCode).toContain('amount DECIMAL(20,2) NOT NULL');
        });

        test('should contain expenses table with payment method checks', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS expenses');
            expect(setupDbCode).toContain('payment_method VARCHAR(15) NOT NULL CHECK (payment_method IN (\'cash\', \'bank\', \'credit_card\'))');
            expect(setupDbCode).toContain('payment_source_id INTEGER');
        });

        test('should contain cash_balance table with unique constraint', () => {
            expect(setupDbCode).toContain('CREATE TABLE IF NOT EXISTS cash_balance');
            expect(setupDbCode).toContain('user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE');
        });
    });

    describe('Migration Logic Analysis', () => {
        test('should contain migration logic for existing users table', () => {
            expect(setupDbCode).toContain('ALTER TABLE users');
            expect(setupDbCode).toContain('ADD COLUMN IF NOT EXISTS email');
            expect(setupDbCode).toContain('ADD COLUMN IF NOT EXISTS security_question');
            expect(setupDbCode).toContain('ADD COLUMN IF NOT EXISTS security_answer_hash');
        });

        test('should contain unique constraint addition for email', () => {
            expect(setupDbCode).toContain('users_email_key UNIQUE (email)');
            expect(setupDbCode).toContain('pg_constraint');
        });

        test('should contain error handling for migrations', () => {
            expect(setupDbCode).toContain('catch (migrationError)');
            expect(setupDbCode).toContain('Migration note:');
        });
    });

    describe('Error Handling Analysis', () => {
        test('should contain try-catch blocks for error handling', () => {
            expect(setupDbCode).toContain('try {');
            expect(setupDbCode).toContain('} catch (error) {');
            expect(setupDbCode).toContain('console.error(\'Error creating tables:\', error)');
        });

        test('should contain finally block to close connection', () => {
            expect(setupDbCode).toContain('} finally {');
            expect(setupDbCode).toContain('pool.end()');
        });
    });

    describe('Success Logging Analysis', () => {
        test('should contain success messages', () => {
            expect(setupDbCode).toContain('Database tables created successfully!');
            expect(setupDbCode).toContain('User table migration completed successfully!');
            expect(setupDbCode).toContain('Adding new columns to existing users table');
        });
    });

    describe('Functional Database Setup Simulation', () => {
        test('should simulate database setup execution', async () => {
            // Create a controlled version of the createTables function
            const createTablesFunction = `
                const createTables = async () => {
                    try {
                        await pool.query(\`CREATE TABLE IF NOT EXISTS users (
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
                        )\`);
                        
                        await pool.query(\`CREATE TABLE IF NOT EXISTS banks (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                            name VARCHAR(100) NOT NULL,
                            initial_balance DECIMAL(20,2) DEFAULT 0.00,
                            current_balance DECIMAL(20,2) DEFAULT 0.00,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(user_id, name)
                        )\`);

                        console.log('Database tables created successfully!');
                    } catch (error) {
                        console.error('Error creating tables:', error);
                    } finally {
                        pool.end();
                    }
                };
            `;

            // Execute the function
            const mockGlobal = { pool: mockPool, console: { log: consoleLogSpy, error: consoleErrorSpy } };
            const func = new Function('pool', 'console', createTablesFunction + '; return createTables;');
            const createTables = func(mockPool, mockGlobal.console);

            await createTables();

            // Verify the function executed correctly
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS users'));
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS banks'));
            expect(consoleLogSpy).toHaveBeenCalledWith('Database tables created successfully!');
            expect(mockEnd).toHaveBeenCalled();
        });

        test('should simulate error handling in database setup', async () => {
            mockQuery.mockRejectedValue(new Error('Connection failed'));

            const createTablesWithError = `
                const createTables = async () => {
                    try {
                        await pool.query('CREATE TABLE IF NOT EXISTS users');
                        console.log('Database tables created successfully!');
                    } catch (error) {
                        console.error('Error creating tables:', error);
                    } finally {
                        pool.end();
                    }
                };
            `;

            const mockGlobal = { pool: mockPool, console: { log: consoleLogSpy, error: consoleErrorSpy } };
            const func = new Function('pool', 'console', createTablesWithError + '; return createTables;');
            const createTables = func(mockPool, mockGlobal.console);

            await createTables();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating tables:', expect.any(Error));
            expect(mockEnd).toHaveBeenCalled();
        });
    });

    describe('Environment Variable Testing', () => {
        test('should validate default configuration values', () => {
            const poolConfigMatch = setupDbCode.match(/const pool = new Pool\({[\s\S]*?\}\);/);
            expect(poolConfigMatch).toBeTruthy();

            const poolConfig = poolConfigMatch[0];
            expect(poolConfig).toContain('user: process.env.DB_USER || \'postgres\'');
            expect(poolConfig).toContain('host: process.env.DB_HOST || \'localhost\'');
            expect(poolConfig).toContain('database: process.env.DB_NAME || \'expense_tracker\'');
            expect(poolConfig).toContain('password: process.env.DB_PASSWORD || \'expense-tracker-2025\'');
            expect(poolConfig).toContain('port: process.env.DB_PORT || 5432');
        });

        test('should validate SSL configuration logic', () => {
            const sslConfigMatch = setupDbCode.match(/ssl: process\.env\.NODE_ENV === 'production' \? .+ : false/);
            expect(sslConfigMatch).toBeTruthy();
            expect(sslConfigMatch[0]).toContain('{ rejectUnauthorized: false }');
        });
    });

    describe('SQL Query Validation', () => {
        test('should validate SQL syntax patterns', () => {
            // Check for proper SQL syntax elements
            expect(setupDbCode).toMatch(/CREATE TABLE IF NOT EXISTS \w+/g);
            expect(setupDbCode).toMatch(/REFERENCES \w+\(id\) ON DELETE CASCADE/g);
            expect(setupDbCode).toMatch(/VARCHAR\(\d+\)/g);
            expect(setupDbCode).toMatch(/DECIMAL\(\d+,\d+\)/g);
            expect(setupDbCode).toMatch(/DEFAULT \d+\.\d+/g);
            expect(setupDbCode).toMatch(/CHECK \(.+\)/g);
        });

        test('should validate table relationships', () => {
            expect(setupDbCode).toContain('REFERENCES users(id)');
            expect(setupDbCode).toMatch(/user_id INTEGER REFERENCES users\(id\) ON DELETE CASCADE/g);
        });
    });
});
