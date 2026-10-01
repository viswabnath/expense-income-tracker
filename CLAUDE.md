# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Express (legacy/) on :3001 + next dev on :3000; open http://localhost:3000
npm run dev:legacy   # Express only, with nodemon
npm run build        # next build
npm run typecheck    # tsc --noEmit
npm run test:unit    # TypeScript unit tests (tests/unit)

# Database
npm run setup-db     # Create/migrate all tables (public schema = production)
npm run setup-test-db  # Same, in the balancetrack_test schema
npm run reset-test-db  # Delete all rows from app tables in the .env database (destructive)

# Testing
npm test                        # Run all tests
npm run test:backend            # Backend Jest project only
npm run test:frontend           # Frontend Jest project only (jsdom)
npm run test:coverage           # With coverage report
npm run test:clean              # Reset test DB then run all tests
npm run test:e2e                # Playwright user flows (starts the app on :3100 against balancetrack_test)
npm run test:contract           # API contract suites against a running server (API_BASE_URL, or starts one on :3200)

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

The Supabase database in `.env` is also production. Production data is in the `public` schema; tests run in `balancetrack_test`. `tests/env.js` (Jest `setupFiles`) forces `DB_SCHEMA=balancetrack_test`, every pool passes it as `search_path`, and `clearTestData`/`deleteTestUser`/`reset-test-db.js` refuse to delete outside a `*_test` schema. Never weaken those guards. Running the app locally without `DB_SCHEMA` reads and writes production data. Run `npm run test:clean` for a clean run. `testTimeout` is 30s because of the remote database round trips, and `maxWorkers` is 1 because suites share one database (parallel runs hang on the Supabase pooler and clobber each other's data).

## Conventions

- **No emoji anywhere**: not in the UI (`legacy/public/`, `app/`), docs, README, or console/log messages. Use plain text labels such as `Warning:` instead. `tests/no-emoji.test.js` enforces this.

## Architecture

### Migration layout (Next.js, in progress: see `docs/nextjs-migration-plan.md`)
- `legacy/`: the current Express app (`server.js`, `public/`, `lib/transaction.js`, own `package.json`). It still serves every page and API route.
- `app/`, `components/`, `lib/*.ts`: the Next.js 16 app (App Router, TypeScript strict). It serves the public pages `/about`, `/security`, `/privacy`, `/terms`, the auth screens `/login`, `/register`, `/forgot-username`, `/forgot-password`, `/welcome` (all in route group `app/(public)`) and `/next-health`. Everything else, including the logged-in app at `/` and all `/api/*`, is still Express. Logged-out visits to `/` redirect to `/login`.
- `vercel.json` defines two Vercel Services (`web` = Next.js at `./`, `legacy` = Express at `legacy/`), with rewrites deciding which one gets each path. To move a path to Next.js, add a rewrite above the catch-all.
- Locally, `npm run dev` and Playwright mirror this: `next.config.ts` forwards unhandled paths to Express when `LEGACY_URL` is set (it must be set at build time too, since rewrites are fixed by `next build`).
- **Adding a Next.js page takes three edits:** the page in `app/`, its path in the `web` rewrite in `vercel.json`, and its path in the `proxy.ts` matcher. Also exclude it from the legacy-only CSP header rule in `vercel.json`. `tests/unit/routing.test.ts` fails if they disagree.
- **CSP for Next.js pages:** `proxy.ts` sets a per-request nonce policy built by `lib/csp.ts`, and pages read `headers()` so they render per request. Never add inline scripts; bundle third-party code from npm instead of loading it from a CDN.
- Ported screens reuse `legacy/public/css/fintech-theme.css` (imported in `app/(public)/layout.tsx`) and keep the legacy class names, so they look the same until the redesign pass.
- `lib/transaction.ts` (Next.js) and `legacy/lib/transaction.js` (Express) must behave identically until Express is removed.
- New server code goes in `lib/` with no Next.js imports; financial logic goes in `src/core/`.

### Backend (`legacy/server.js`)
Single-file Express.js server. All routes live here. When you add or change a route, update `docs/API.md` to match. Key patterns:
- `requireAuth` middleware guards all `/api/*` routes except auth endpoints
- **Transactions:** any write touching more than one row or table runs in `withTransaction(pool, async (client) => ...)` from `legacy/lib/transaction.js`, with every query on `client`. Never call `pool.query('BEGIN')`: the pool can use a different connection per query (`tests/atomic-writes.test.js` guards this). Throw `RequestError(status, message)` for expected failures inside a transaction and answer with `sendError(res, error)`.
- `logActivity(client, userId, ...)` takes the transaction's client and throws on failure, so the log entry commits or rolls back with the change it describes. Call it inside the same `withTransaction`.
- Lock rows you check or modify with `SELECT ... FOR UPDATE` inside the transaction.
- Sessions stored in PostgreSQL via `connect-pg-simple`
- `authLimiter` allows 5 failed auth attempts per 15 min and is skipped when `NODE_ENV` is `development` or `test`. `generalLimiter` allows 100 req/min.
- Helmet sends a CSP (see the `helmet({...})` directives). Adding a new external script, font or API origin needs a matching directive. `upgrade-insecure-requests` is production-only because Safari applies it to http://localhost.
- The production HTTP→HTTPS redirect is the first middleware; keep it above `express.static`.
- Deployed on Vercel as the `legacy` service: `legacy/server.js` must keep `module.exports = app` (Vercel runs the exported app as a function; `app.listen` only runs locally). On Vercel `legacy/public/` is served by the CDN without Express, so the security headers are duplicated in `vercel.json`. Change both together; `tests/security-middleware.test.js` fails if they differ.
- Middleware reads `NODE_ENV` once at load time. `tests/security-middleware.test.js` uses `jest.isolateModules` to load the server under other environments.
- Build SQL with `$n` parameters only, never string interpolation (`/api/activity` had an injection bug from this)
- SSL enabled automatically when `NODE_ENV=production` or `DB_SSL=true`

### Database (`setup-db.js`)
Tables: `users`, `banks`, `credit_cards`, `income_entries`, `expenses`, `cash_balance`, `activity_log`, `session`
- Every table has row level security enabled with no policies, which blocks Supabase's public Data API. Enable RLS on any new table.
- `DB_SCHEMA` (optional) selects the Postgres schema via `search_path`; unset means `public`
- All monetary columns use `DECIMAL(20,2)`
- `activity_log` stores `old_values`/`new_values` as JSONB for change tracking
- `income_entries` references `credited_to_type` (`bank`|`cash`) and `credited_to_id`
- `expenses` references `payment_method` (`cash`|`bank`|`credit_card`) and `payment_source_id`

### Frontend (`legacy/public/js/`)
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
- **backend** project: `testEnvironment: node`, for `legacy/server.js` and `setup-db.js`
- **frontend** project: `testEnvironment: jsdom`, for `legacy/public/js/**`
- **unit** project: TypeScript via `@swc/jest`, for `lib/**/*.ts` and `src/**/*.ts` (`tests/unit/`)

Each project lists its files explicitly in `testMatch`. **A new test file does not run until you add it there.**

`tests/env.js` runs before every test file (per-project `setupFiles`). `tests/setup.js` is **not** currently run: it is listed in the top-level `setupFilesAfterEnv`, which Jest ignores when `projects` is defined.

`test-helpers.js` provides `clearTestData()`, `createTestUser()`, `deleteTestUser(username)` and other utilities that hit the real database. Use them rather than creating new pool connections, and have suites that register their own users call `deleteTestUser` in `beforeAll`/`afterAll` so reruns don't fail with "username exists". Test passwords must satisfy `validatePassword` (special chars: `_ - @ : &` only).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
