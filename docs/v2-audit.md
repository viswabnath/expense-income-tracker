# BalanceTrack v2 audit

_Audited 2026-09-30 at commit `540135f` (branch `changes`). Read-only; no code was changed._

This audit covers what the v2 brief asked for. It also covers places where the brief's assumptions do not match this repository. Those mismatches need decisions before Phase 1 (see [Decisions needed](#decisions-needed-before-phase-1)).

## 1. The brief vs the actual stack

| The brief assumes | This repository |
|---|---|
| Next.js / React | Plain JavaScript with no framework and no build step. `public/index.html` plus 12 class-based modules in `public/js/`, served as static files. |
| TypeScript, type checks | Plain JavaScript. There is no type checker; ESLint is the only static check. |
| Supabase Auth, `auth.uid()` | Custom auth: a `users` table with `SERIAL` integer ids, bcrypt hashes, and `express-session` sessions stored in Postgres. Supabase is used only as a Postgres host. The app never uses the Supabase client or Auth. |
| RLS policies enforce per-user isolation | The app connects as the table owner through `pg`, so RLS does not apply to it. Isolation is enforced by `WHERE user_id = $n` in each query. RLS is enabled with no policies, only to block Supabase's public Data API. |
| `supabase/migrations`, forward-only | No migration tool. `setup-db.js` is an idempotent script (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). |
| Radix primitives | Radix is React-only and cannot be used without introducing React. |

## 2. Folder structure

```
server.js            Express app: all 31 API routes, auth, middleware (2,046 lines)
setup-db.js          Idempotent schema script (tables, indexes, RLS)
reset-test-db.js     Clears the balancetrack_test schema (refuses any other schema)
test-helpers.js      Test DB helpers (clearTestData, createTestUser, deleteTestUser)
vercel.json          Vercel config: region syd1, security headers for static files
public/
  index.html         Single page; sections shown/hidden by NavigationManager
  css/fintech-theme.css
  js/                api, app, auth, setup-manager, transaction-manager, summary-manager,
                     activity-manager, navigation-manager, toast-manager,
                     event-handlers, initialization, module-validator
tests/               Jest: backend project (12 suites, real DB) + frontend project (9, jsdom)
docs/                API.md, STATUS.md, this audit
```

Deployment: Vercel runs `server.js` as one Node.js function. `public/` is served from the CDN. The database is a single Supabase project: production data is in schema `public`, and tests use `balancetrack_test`.

## 3. Auth approach

- **Registration** (`server.js:185`): the server validates username format, password strength (`validatePassword`, `server.js:131`: 8-16 chars with upper, lower, digit and one of `_ - @ : &`), and email format. It stores a bcrypt hash of the password and of the lower-cased, trimmed security answer, then logs the user in by setting `req.session.userId`.
- **Login** (`server.js:280`): looks up the user by username and checks the password with bcrypt. On success it calls `req.session.regenerate` (session fixation protection), then sets `userId`. A wrong username and a wrong password return the same message.
- **Auth guard**: `requireAuth` (`server.js:174`) only checks that `req.session.userId` is set. Every data route derives the user from the session, never from the request body.

## 4. Security-question flow

1. `POST /api/forgot-password` (`server.js:407`) takes a username **or** an email. It returns `userId`, `username`, `name` and `securityQuestion`.
2. `POST /api/reset-password` (`server.js:467`) takes `userId`, `securityAnswer` and `newPassword`. It compares the answer with bcrypt and updates the hash.
3. `POST /api/forgot-username` (`server.js:369`) takes an email and returns the `username` and `name` directly, with no verification.

Issues for a public product (all listed in the risk table):
- Anyone who knows an email address learns the account's username and full name.
- Both endpoints confirm whether an account exists (404 vs 200).
- Answers such as city of birth or first pet are guessable. The only brake is the rate limit, which counts per IP and per function instance.
- A password reset does not end the user's other active sessions.

## 5. Sessions and login blocking

- **Sessions** (`server.js:111`): `express-session` with the `connect-pg-simple` store (table `session`). The cookie is named `sessionId` and is `httpOnly`, `sameSite: 'strict'`, `secure` in production, with a `maxAge` of 2 hours.
- **Secret fallback** (`server.js:113`): if `SESSION_SECRET` is unset, each process generates a random secret. On Vercel every function instance would then have a different secret, and users would be logged out whenever a request lands on another instance.
- **Logout** (`server.js:1811`): destroys the session in the database, but clears a cookie named `connect.sid` instead of `sessionId`, so the stale cookie stays in the browser. This is harmless because the session is gone, but it is incorrect.
- **"Failed-login blocking"** is `express-rate-limit` (`server.js:61`): 5 failed requests per 15 minutes per IP, across register, login and all recovery endpoints, and only when `NODE_ENV` is not `development` or `test`. There is no per-account lockout. The counter is in memory, so on Vercel each instance counts separately.
- **General limit**: 100 requests per minute per IP (`server.js:74`), also in memory.

## 6. Schema and RLS

Tables (all created by `setup-db.js`): `users`, `banks`, `credit_cards`, `income_entries`, `expenses`, `cash_balance`, `activity_log`, `session`.

| Table | Key columns |
|---|---|
| users | id SERIAL, username UNIQUE, email UNIQUE, password_hash, security_question, security_answer_hash, tracking_option CHECK (income, expenses, both) |
| banks | user_id, name (UNIQUE per user), initial_balance, current_balance |
| credit_cards | user_id, name (UNIQUE per user), credit_limit, used_limit |
| income_entries | user_id, source, amount, credited_to_type (bank, cash), credited_to_id, date, month, year |
| expenses | user_id, title, amount, payment_method (cash, bank, credit_card), payment_source_id, date, month, year |
| cash_balance | user_id UNIQUE, balance, initial_balance |
| activity_log | user_id, action_type, entity_type, entity_id, description, amount, old_values JSONB, new_values JSONB |
| session | sid, sess JSON, expire |

- **Foreign keys**: `user_id REFERENCES users ON DELETE CASCADE`. `credited_to_id` and `payment_source_id` are **not** foreign keys; they point at `banks.id` or `credit_cards.id` depending on another column, so the database cannot check them.
- **RLS**: enabled on all 8 tables in both schemas, with **no policies**. This blocks the `anon` and `authenticated` roles used by Supabase's Data API. The app connects as the owner and is unaffected.
- **Indexes**: primary keys, the unique constraints, and 5 per-user indexes added on 2026-09-30.

## 7. How balances are computed

There are two separate mechanisms, and they can disagree:

1. **Stored running balances**: `banks.current_balance`, `cash_balance.balance` and `credit_cards.used_limit` are incremented and decremented by the income and expense routes on create, update and delete. These drive the Setup screen and the "current" views.
2. **Derived month-end balances**: the monthly summary (`server.js:1533`) recalculates each bank's and cash's balance at month end as `initial_balance + SUM(income) - SUM(expenses)` up to that date. It recalculates card usage from expenses.

The two agree only if every stored update was applied exactly once. Three things can break that:
- the non-atomic writes below,
- the cash endpoint accepting an absolute value,
- activity log inserts that fail silently.

**Cash can be set from the client**: `POST /api/cash-balance` (`server.js:618`) with only `balance` sets the running balance to the value sent, while `initial_balance` stays the same. The Setup screen sends the typed amount (`setup-manager.js:333`). After such an edit, the stored cash balance and the derived month-end cash balance differ.

**Net savings** today is `initial balances + month income - month expenses` (`server.js` in the summary route). That is closer to "wealth at start plus this month's flow" than to savings. The brief redefines it as income minus expenses.

## 8. How amounts are stored

- In the database: every money column is `DECIMAL(20,2)`, which is exact. **No floats are stored.**
- In code: values come back from `pg` as strings and are converted with `parseFloat` (16 places in `server.js`, 48 in `public/js/`). Totals and balances are then added in floating point before display. Rounding errors are possible in displayed sums; stored values are not affected.
- Display: `toLocaleString('en-IN')` with the rupee symbol in the activity feed. Formatting is not centralized.

**Conversion plan (for approval, nothing done):** keep existing `DECIMAL(20,2)` columns as they are, since they are exact. New tables use `bigint` paise as the brief specifies. A shared money module converts `DECIMAL` strings to paise integers on read (`'1234.50'` becomes `123450`, parsed from the string, never through `parseFloat`), so existing and new amounts are added as integers. Moving old columns to paise can come later as its own migration, run as an add-column / backfill / verify / swap sequence.

## 9. How the activity log is written

`logActivity()` (`server.js:161`) inserts one row with `old_values` and `new_values` as JSONB. It:
- uses the shared pool, not the connection running the route's writes, so it is never part of the same transaction;
- catches and logs its own errors, so a failed insert is silent and the change is still reported as successful.

The feed and CSV export are served by `GET /api/activity` (`server.js:1822`). Its `account_info` column is built by a SQL `CASE` over `entity_type`. New entity types need new cases there, or they show no account.

CSV export (`server.js:1964-1973`) does not escape double quotes inside descriptions, which breaks the row. It also does not neutralize values starting with `=`, `+`, `-` or `@`, which spreadsheets run as formulas (CSV injection). Bank and card names are user input and appear in descriptions.

## 10. How tracking mode gates screens

`users.tracking_option` is one of `income`, `expenses`, `both`, set at sign-up via `POST /api/set-tracking-option`. Gating is **client-side only**:
- `app.js:44` stores the value;
- `transaction-manager.js:392-397` hides the income or expense form;
- `setup-manager.js:120` hides card setup for income-only users;
- `summary-manager.js:214` shows the expense lines.

The server does not reject requests for hidden modules. The only server-side use is skipping a balance check for expenses-only users (`server.js:1043-1047`). That is acceptable for a display preference, but the new module toggles should follow the same rule deliberately.

## 11. Current UI against the brief's design rules

| Rule | Current state |
|---|---|
| No emoji | Already done (enforced by `tests/no-emoji.test.js`) |
| Not Inter; IBM Plex Sans or Source Sans 3 | Uses Inter |
| Borders instead of shadows | 46 `box-shadow` declarations |
| No glassmorphism | 3 `backdrop-filter` declarations |
| No gradients | None |
| Tabular numerals | 2 uses of `tabular-nums` |
| Light and dark themes via tokens | 39 CSS variables; no dark theme |
| Charts | No chart library; the Content-Security-Policy only allows scripts from the site itself and unpkg, and `vercel.json` must match (a test checks) |

## 12. Risks

| Severity | Risk | Where |
|---|---|---|
| **Critical** | Edit and delete of income and expenses run `pool.query('BEGIN')` on the connection pool. Each pool query can run on a different connection, so the writes are not atomic. The open transaction is also handed to other requests. Reproduced against the test schema: after one `pool.query('BEGIN')`, 4 of 6 later queries ran inside that leaked transaction. A rollback or dropped connection can discard **other users'** writes. | `server.js` PUT/DELETE `/api/income/:id`, `/api/expenses/:id` (BEGIN at lines 1214, 1298, 1387, 1481) |
| High | Creating income or expenses makes separate writes (entry insert, balance update, activity insert) with no transaction. A failure midway leaves an entry without its balance change, or the reverse. | `server.js:894`, `server.js:1003` |
| High | Username and name are disclosed to anyone who knows the email; the recovery endpoints reveal whether accounts exist; the security answers are guessable. | `server.js:369`, `407`, `467` |
| High | If `SESSION_SECRET` is missing in production, each Vercel instance uses its own random secret and logins break. The server should refuse to start instead. | `server.js:113` |
| Medium | Stored running balances and derived month-end balances can disagree (section 7); the cash endpoint accepts an absolute balance from the client. | `server.js:618`, summary route |
| Medium | Activity log writes are outside the transaction and fail silently. | `server.js:161` |
| Medium | Money is added in floating point after `parseFloat`. | 64 call sites |
| Medium | Rate limits are in memory, so per instance on Vercel, and are per IP only (no account lockout). | `server.js:61`, `74` |
| Medium | CSV export: no quote escaping, and formula injection is possible. | `server.js:1968` |
| Low | `credited_to_id` and `payment_source_id` are not foreign keys, so deleting a bank relies on application checks. | schema |
| Low | Logout clears the wrong cookie name. | `server.js:1816` |
| Low | `tests/setup.js` never runs: `setupFilesAfterEnv` is at the top level, which Jest ignores when `projects` is used. | `package.json` |
| Low | Password reset does not invalidate existing sessions. | `server.js:467` |

## Decisions needed before Phase 1

1. **Stack.** The brief says not to rewrite, but Next.js, React, Radix and TypeScript are not in this app. Options:
   - (a) keep plain JavaScript and Express, build the design system as CSS tokens plus small unstyled components, and add type checking with JSDoc and `tsc --checkJs`;
   - (b) migrate the frontend to Next.js first, which is effectively a rewrite of every screen.

   Recommendation: (a).
2. **RLS and `auth.uid()`.** The app has no Supabase Auth users, and its user ids are integers. Options:
   - (a) keep isolation in the SQL queries, keep deny-all RLS, and write automated cross-user tests against the API for every new table;
   - (b) run each request inside a transaction that sets `app.user_id`, and add real RLS policies `using (current_setting('app.user_id')::int = user_id)`, so the database also enforces isolation;
   - (c) move to Supabase Auth first (the brief's Phase 6), so `auth.uid()` exists.

   Recommendation: (b). It gives database-enforced isolation now and does not depend on Phase 6.
3. **Migrations.** Adopt `supabase/migrations` with the Supabase CLI and a baseline migration generated from the current schema, then retire `setup-db.js` for schema changes. This needs the CLI linked to the project, which the Supabase connector in this session cannot do (it returned "no permission"). Alternatively, use plain numbered SQL files in `supabase/migrations/` applied by a small runner script that records applied versions in a table.
4. **Fix the critical and high risks first.** Edit/delete correctness is a Phase 1 requirement, and it cannot be tested reliably while the existing edit and delete routes are not atomic. The proposal is a short Phase 0:
   - real transactions on one connection for all income and expense writes;
   - activity log inside the same transaction;
   - failing fast without `SESSION_SECRET`.

   No behaviour change for users.
5. **Font.** Choose IBM Plex Sans or Source Sans 3. Either is loaded from Google Fonts, which the CSP already allows.
6. **Charts.** Either (a) hand-written SVG in the core UI layer, with no dependency and no CSP change; or (b) a pinned chart library with an SRI hash, added to the CSP in `server.js` and `vercel.json`.

## Decisions (2026-09-30)

| # | Decision |
|---|---|
| 1 | **Move to Next.js.** Planned as its own phase after Phase 0. Data-layer code goes in framework-free modules (`lib/`) so it carries over unchanged. |
| 2 | **Database-enforced isolation via `app.user_id`** (option b). Introduced with the Phase 1 data model. |
| 3 | **Migrations:** handled by the owner. |
| 4 | **Phase 0 approved** (done, see below). |
| 5 | **Font:** Source Sans 3. |
| 6 | **Charts:** a pinned chart library, added to the CSP in `server.js` and `vercel.json`. |

## Phase 0 result

Fixed:
- **Critical:** income and expense edit/delete no longer use `pool.query('BEGIN')`.
- **High:** income and expense creation are now atomic.
- **High:** the server refuses to start in production without `SESSION_SECRET`.
- **Medium:** activity log entries are written inside the same transaction and no longer fail silently.

How:
- `lib/transaction.js` provides `withTransaction(pool, fn)` and `RequestError`.
- The 8 routes that change balances or write the activity log (add bank, add card, set cash, and add/edit/delete for income and expenses) run in one transaction on one connection.
- `logActivity(client, ...)` writes on that connection and rethrows. A failed log entry now rolls back the change instead of being skipped.
- Rows being checked or changed are locked with `FOR UPDATE`, so concurrent expenses can no longer both pass the balance check, and concurrent edits can no longer both reverse the same old amount.

Tests:
- `tests/transaction-helper.test.js`: commit, rollback, release, and rollback-failure handling.
- `tests/atomic-writes.test.js`: a trigger in the test schema forces the activity log insert to fail. Adding income or expenses, editing income and deleting an expense then leave no partial changes. It also covers edit and delete restoring balances exactly, one log entry per change, and a guard against `pool.query('BEGIN')`.

Verified: the new atomicity tests fail on the previous `server.js` (4 partial-write failures plus the guard) and pass on the new one.

Unchanged by design, still open:
- **Expenses-only users:** adding an expense did not change balances, but editing or deleting one did. Decided 2026-09-30: balances always change. Fixed in `POST /api/expenses`, with a test in `tests/atomic-writes.test.js`. No production user had tracking option `expenses`, so no data correction was needed.
- Bank edit/delete and card delete already used a correct single-connection transaction and write no activity log entries. They should log activity under the brief's rule 8.
