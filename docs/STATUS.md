# BalanceTrack - Project Status

_Last reviewed: 2026-09-30_

## Summary

The core features work: auth, accounts, transactions, the activity log and monthly summaries. The full test suite passes (356 passed, 2 skipped, 26 suites; plus 11 Playwright flows and 70 API contract tests). The security gaps found on 2026-09-30 are fixed; the remaining [known issues](#known-issues) are low severity.

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
| backend | node | 14 | Uses the real database from `.env` (test schema) |
| frontend | jsdom | 9 | `fetch` is mocked; includes the no-emoji check |

- `npm run test:clean` resets the database and runs everything.
- Tests share the production Supabase database but run in the `balancetrack_test` schema. `tests/env.js` sets `DB_SCHEMA`, and `clearTestData`, `deleteTestUser` and `reset-test-db.js` refuse to delete outside a `*_test` schema.
- `testTimeout` is 30s because each request makes a round trip to the remote database. `maxWorkers` is 1: suites share one database, and parallel runs exhausted the Supabase pooler and wiped each other's data. A full run takes about 3 minutes.

## Deployment

- **Vercel**: two services in one project during the Next.js migration: `web` (Next.js) and `legacy` (the Express app in `legacy/`, run as a function in `syd1`, next to Supabase `ap-southeast-2`, with `legacy/public/` on the CDN). `vercel.json` repeats helmet's security headers for static files, and a test keeps the two in sync.
- **Supabase**: one project. Production data is in `public`, and tests use `balancetrack_test`. It is reached through the transaction pooler (port 6543) with SSL, and every table has RLS enabled to block the public Data API.
- Setup steps are in the README under "Deployment (Vercel + Supabase)".

## Known issues

| Severity | Issue | Where |
|---|---|---|
| Medium | Account recovery still rests on a security question, which a person who knows the user can often answer. Guessing is now limited to 5 tries per 15 minutes per account. The real fix is recovery by an emailed link, which needs an email provider (planned for Phase 6) | `legacy/server.js` recovery routes |
| Low | Registration still says when a username or email is already taken, so it can be used to check whether an email has an account. Closing it also needs email verification | `POST /api/register` |
| Low | Logout clears a cookie named `connect.sid` instead of `sessionId` | `legacy/server.js`, logout route |
| Medium | Legacy toasts insert their message as HTML (`toast-manager.js` uses `innerHTML`); messages can include the user's free-text name. CSP blocks inline script handlers, which limits the impact, and the Next.js toasts render text only | `legacy/public/js/toast-manager.js` |
| Low | `edge-cases` occasionally fails in the full Jest run: a 401 after its re-login (seen before the transaction fix) or its `beforeAll` exceeding 30s (seen once after it). It passes on its own and in most full runs, and a lock probe during a passing run found no stuck transactions. Likely remote-database latency, not confirmed | `tests/edge-cases.test.js` |
| Low | Transaction dates are sent to the browser as timestamps at the server's midnight, and the add forms default to the UTC date. In a browser far from the server's time zone, or just after midnight IST, a date can show or default to the neighbouring day. To fix with the v2 data model | `legacy/server.js`, `lib/dates.ts` |
| Low | In end-to-end runs, `POST /api/set-tracking-option` (Express) sometimes gets no response for over 15 s right after registration. Seen in 3 full runs on 2026-10-02, while every other request took about 1.3 s. Reruns pass, and other requests in those runs answered. Cause not found yet; to look at again when the auth routes move to Next.js | `legacy/server.js`, `tests/e2e/helpers.js` (`chooseTracking`) |
| Low | The monthly summary leaves out banks and cards created on the last day of the month, because its cut-off is the start of that day. Kept as is in the Next.js port; the summary is rebuilt in v2 Phase 1 | `lib/services/reports.ts` |
| Low | `tests/setup.js` never runs: `setupFilesAfterEnv` is set at the top level, which Jest ignores when `projects` is used | `package.json` |
| Low | Auth rate-limit counters are in memory, so on Vercel each function instance counts separately | `legacy/server.js`, `authLimiter` |
| Low | 9 ESLint warnings, all in three obsolete test files that aren't run (`comprehensive-coverage`, `server-coverage`, `frontend-execution-coverage`) | `tests/` |

### Fixed on 2026-10-02
- Income and expense entries accepted any account id the client sent, including another user's bank or card (balances were never touched, but the entry pointed at that account). Adding or editing an entry now refuses an account that is not the user's own (`Bank not found`, `Credit card not found`) and an unknown account type (`Invalid account type`), in both apps (`tests/account-ownership.test.js`).
- **Cross-user disclosure:** the activity feed looked up account names without limiting them to the user's own accounts. A user who edited an income entry onto another user's bank id saw that bank's name in their feed. All lookups are now limited to the user's own accounts, in both apps (`tests/activity-api.test.js`, which fails on the old code).
- The monthly summary's error response included the raw database error (`details`); it now stays in the server log.
- The overspend check compared the stored balance text with the amount, so an amount sent as a string (`"700"`) was compared as text and a valid expense could be refused. Both apps now compare numbers.
- The database pools had no time limits, so a stalled Supabase connection held requests open indefinitely (a test-database reset once hung for 7 hours, and several end-to-end runs stalled). The app's pool now gives up on a connection after 10 s and on a query after 20 s; the test and setup scripts after 10 s and 60 s. `withTransaction` closes a connection whose rollback failed instead of returning it to the pool.
- The activity CSV export did not escape quotes, and a value starting with `=`, `+`, `-` or `@` (for example a bank name) would run as a formula in a spreadsheet. Every field is now quoted with quotes doubled, and formula-like values are prefixed with an apostrophe.
- The activity feed showed only the 20 most recent entries; the API's total ignored the filters; and a non-numeric `limit` caused a 500.
- Adding income or an expense converted the chosen date through the server's local time. On a server east of UTC (any local run in India), an entry added between midnight and 05:30 was stored on the previous day, but under the new month. It then vanished from its month after an edit. Edits had the matching problem on servers west of UTC. Production runs in UTC and was not affected. Dates are now read straight from `YYYY-MM-DD`, and impossible dates such as 2026-02-30 are refused (`tests/entry-dates.test.js`).

### Fixed on 2026-10-01
- Account recovery revealed the username and name for any email and confirmed whether an account existed. Password reset accepted a bare user id, so answers could be guessed account by account without knowing anyone's details. Now:
  - unknown accounts get a stable made-up question;
  - every failure gets the same message;
  - the username comes back only after the security answer;
  - reset needs the username or email;
  - 5 wrong answers in 15 minutes pause recovery for that account;
  - a reset signs out all of that account's sessions and is recorded in its activity log.
- Bank edit/delete and card delete returned early inside an open transaction and released the connection mid-transaction, so later requests on that pooled connection ran inside it. Users were intermittently treated as logged out right after login or registration (the Setup end-to-end tests failed this way whenever they ran after a refused delete). Card delete also ran its DELETE outside the transaction. All three now use `withTransaction`.
- Auth forms and the welcome step could ignore a click made before React hydrated. Their controls now stay disabled until the page is interactive (`components/HydrationGate.tsx`).

### Fixed on 2026-09-30
- Income and expense edit/delete ran `pool.query('BEGIN')`, so their writes were not atomic and the open transaction leaked to other requests. All writes that change balances now run in one transaction via `legacy/lib/transaction.js`, with the activity log entry inside it (`tests/atomic-writes.test.js`).
- The server refuses to start in production without `SESSION_SECRET`.
- Expenses-only users: adding an expense now changes balances like editing and deleting already did (decision: balances always change). They still skip the overspend check, so their balances can go negative.
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
