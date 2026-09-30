# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start server with nodemon (auto-reload)
npm start            # Start server (production)

# Database
npm run setup-db     # Create/migrate all tables
npm run reset-test-db  # Delete all rows from app tables in the .env database (destructive)

# Testing
npm test                        # Run all tests
npm run test:backend            # Backend Jest project only
npm run test:frontend           # Frontend Jest project only (jsdom)
npm run test:coverage           # With coverage report
npm run test:clean              # Reset test DB then run all tests

# Run a single test file
npx jest tests/server.test.js --detectOpenHandles --forceExit

# Linting
npm run lint         # Check
npm run lint:fix     # Auto-fix
```

### Environment setup

Create a `.env` file:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=expense_tracker
DB_PASSWORD=your-password
DB_PORT=5432
SESSION_SECRET=your-secure-secret
NODE_ENV=development
```

Backend tests connect to the database in `.env` (no separate test DB) and delete all rows in the app tables. The local `.env` points at the development Supabase database; production uses the Render database from `render.yaml`. Confirm the target DB before running backend tests. Run `npm run test:clean` for a clean run. `testTimeout` is 30s because of the remote database round trips, and `maxWorkers` is 1 because suites share one database (parallel runs hang on the Supabase pooler and clobber each other's data).

## Architecture

### Backend (`server.js`)
Single-file Express.js server. All routes live here. When you add or change a route, update `docs/API.md` to match. Key patterns:
- `requireAuth` middleware guards all `/api/*` routes except auth endpoints
- `logActivity()` is called after every mutating operation to write to `activity_log`
- Sessions stored in PostgreSQL via `connect-pg-simple`
- `authLimiter` allows 5 failed auth attempts per 15 min and is skipped when `NODE_ENV` is `development` or `test`. `generalLimiter` allows 100 req/min.
- Helmet sends a CSP (see the `helmet({...})` directives). Adding a new external script, font or API origin needs a matching directive. `upgrade-insecure-requests` is production-only because Safari applies it to http://localhost.
- The production HTTP→HTTPS redirect is the first middleware; keep it above `express.static`.
- Middleware reads `NODE_ENV` once at load time. `tests/security-middleware.test.js` uses `jest.isolateModules` to load the server under other environments.
- Build SQL with `$n` parameters only, never string interpolation (`/api/activity` had an injection bug from this)
- SSL enabled automatically when `NODE_ENV=production` or `DB_SSL=true`

### Database (`setup-db.js`)
Tables: `users`, `banks`, `credit_cards`, `income_entries`, `expenses`, `cash_balance`, `activity_log`
- All monetary columns use `DECIMAL(20,2)`
- `activity_log` stores `old_values`/`new_values` as JSONB for change tracking
- `income_entries` references `credited_to_type` (`bank`|`cash`) and `credited_to_id`
- `expenses` references `payment_method` (`cash`|`bank`|`credit_card`) and `payment_source_id`

### Frontend (`public/js/`)
Vanilla JS with a class-based modular architecture. Modules are loaded as global instances on `window`:
- `app.js` — `ExpenseTracker` class; entry point, checks auth status and routes to login or main app
- `auth.js` — `AuthManager`; login, register, password reset
- `setup-manager.js` — `SetupManager`; bank/credit card/cash balance CRUD
- `transaction-manager.js` — `TransactionManager`; income/expense CRUD and filtering
- `summary-manager.js` — `SummaryManager`; monthly summary calculations
- `activity-manager.js` — `ActivityManager`; unified activity feed with change tracking
- `navigation-manager.js` — `NavigationManager`; section transitions and sidebar
- `api.js` — `ApiClient` (static methods); centralized `fetch` wrapper and global loader
- `toast-manager.js` — `ToastManager`; `showSuccess()`, `showError()`, `showInfo()`, `showWarning()` globals
- `event-handlers.js` — `EventHandlers`; all DOM event listeners. Buttons use `data-action`, and navigation uses `data-action="showSection" data-section="..."`
- `initialization.js` — `InitializationManager`; runs on DOMContentLoaded

The frontend is strictly CSP-compliant: no inline JavaScript or `eval`. All event listeners are attached programmatically in `event-handlers.js`. `tests/csp-compliance.test.js` fails on any `onclick=` in `index.html`. `module-validator.js` is only used by tests and is not loaded by `index.html`.

### Test structure (`tests/`)
Jest uses two projects configured in `package.json`:
- **backend** project: `testEnvironment: node`, for `server.js` and `setup-db.js`
- **frontend** project: `testEnvironment: jsdom`, for `public/js/**`

Each project lists its files explicitly in `testMatch`. **A new test file does not run until you add it there.**

`tests/setup.js` runs before every test: sets `NODE_ENV=test`, mocks `fetch`, and tears down DB pools after all tests.

`test-helpers.js` provides `clearTestData()`, `createTestUser()`, `deleteTestUser(username)` and other utilities that hit the real database. Use them rather than creating new pool connections, and have suites that register their own users call `deleteTestUser` in `beforeAll`/`afterAll` so reruns don't fail with "username exists". Test passwords must satisfy `validatePassword` (special chars: `_ - @ : &` only).
