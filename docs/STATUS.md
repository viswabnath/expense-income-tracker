# BalanceTrack - Project Status

_Last reviewed: 2026-09-30_

## Summary

The core features work: auth, accounts, transactions, the activity log and monthly summaries. The full test suite passes (315 passed, 2 skipped, 21 suites). The security gaps found on 2026-09-30 are fixed; the remaining [known issues](#known-issues) are low severity.

## Features

### Authentication
- [x] Registration with server-side validation (username format, 8–16 char password with upper/lower/digit/special)
- [x] Login/logout with PostgreSQL-backed sessions (2-hour, HTTP-only, `SameSite=strict`)
- [x] Username recovery by email; password reset by security question
- [x] bcrypt hashing for passwords and security answers
- [x] Auth-endpoint rate limiting (5 failed attempts / 15 min; off in development and test)

### Accounts
- [x] Banks: CRUD; deletion blocked while transactions exist
- [x] Credit cards: CRUD with limit and used-limit tracking
- [x] Cash balance with separate initial and running balance
- [x] `DECIMAL(20,2)` for all money columns

### Transactions
- [x] Income (credited to a bank or cash) and expenses (paid by cash, bank or credit card)
- [x] Create/edit/delete keeps account balances in sync
- [x] Month/year filtering

### Activity log
- [x] Every mutating operation is logged with old/new values (JSONB)
- [x] Filtering by entity type, month/year or date range; pagination; CSV export

### Reporting
- [x] Monthly summary: income, expenses, net savings, current wealth, per-account balances
- [x] Tracking modes: income only, expenses only, or both

### Frontend
- [x] Vanilla JS, one class per concern (see `CLAUDE.md`)
- [x] No inline scripts or event handlers; all listeners are attached in `event-handlers.js`
- [x] Responsive layout with sidebar navigation
- [x] About / Security / Privacy / Terms pages

## Testing

| Project | Environment | Suites | Notes |
|---|---|---|---|
| backend | node | 12 | Uses the real database from `.env` |
| frontend | jsdom | 9 | `fetch` is mocked; includes the no-emoji check |

- `npm run test:clean` resets the database and runs everything.
- Tests share the production Supabase database but run in the `balancetrack_test` schema. `tests/env.js` sets `DB_SCHEMA`, and `clearTestData`, `deleteTestUser` and `reset-test-db.js` refuse to delete outside a `*_test` schema.
- `testTimeout` is 30s because each request makes a round trip to the remote database. `maxWorkers` is 1: suites share one database, and parallel runs exhausted the Supabase pooler and wiped each other's data. A full run takes about 3 minutes.

## Deployment

- **Vercel**: `server.js` exports the Express app, which Vercel runs as a function in `syd1` (next to Supabase `ap-southeast-2`); `public/` is served from the CDN. `vercel.json` repeats helmet's security headers for static files, and a test keeps the two in sync.
- **Supabase**: one project. Production data is in `public`, and tests use `balancetrack_test`. It is reached through the transaction pooler (port 6543) with SSL, and every table has RLS enabled to block the public Data API.
- Setup steps are in the README under "Deployment (Vercel + Supabase)".

## Known issues

| Severity | Issue | Where |
|---|---|---|
| Low | `tests/setup.js` never runs: `setupFilesAfterEnv` is set at the top level, which Jest ignores when `projects` is used | `package.json` |
| Low | Auth rate-limit counters are in memory, so on Vercel each function instance counts separately | `server.js`, `authLimiter` |
| Low | 9 ESLint warnings, all in three obsolete test files that aren't run (`comprehensive-coverage`, `server-coverage`, `frontend-execution-coverage`) | `tests/` |

### Fixed on 2026-09-30
- SQL injection in `GET /api/activity?type=` (the value was concatenated into the query, which let one user read other users' activity). Now parameterized, with a regression test in `tests/integration.test.js`.
- Footer links used inline `onclick`, which a CSP blocks. They now use `data-action`.
- Edge-case, bank-deletion and cash-balance tests were fixed; the latter two now clean up their test users.
- Auth rate limiter re-enabled (it had been a pass-through in every environment, including production). Only failed attempts count.
- Helmet Content-Security-Policy enabled. `upgrade-insecure-requests` is production-only (it broke Safari on http://localhost).
- The HTTPS redirect was registered after all routes, so it never ran. It is now the first middleware and only redirects when the proxy reports `http`.
- `npm audit fix`: 18 vulnerabilities → 0 (lockfile only, no major upgrades).
- Lucide pinned to 1.49.0 with an SRI hash instead of `@latest`.
- ESLint warnings 73 → 9.
- New `tests/security-middleware.test.js` covers the CSP, redirect and rate limiter.
