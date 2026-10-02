# BalanceTrack

A personal finance tracker for people in India. You enter your money manually: bank accounts, credit cards, cash, income and expenses. BalanceTrack keeps the balances up to date and shows where your money went each month. It does not connect to banks. Amounts are shown in rupees with Indian digit grouping (5,00,000).

## Where it is going

BalanceTrack is being extended into a public personal-finance product. The plan has two tracks, run one after the other.

**1. Move to Next.js (done).** The app moved from plain JavaScript with Express to Next.js one piece at a time, without changing behaviour except for the fixes listed in [docs/STATUS.md](docs/STATUS.md). See [docs/nextjs-migration-plan.md](docs/nextjs-migration-plan.md).

| Step | What | Status |
|---|---|---|
| Phase 0 | Atomic writes, activity log inside transactions, audit fixes | Done |
| N0 | Safety net: Playwright user flows, API contract suites | Done |
| N1 | Express moved to `legacy/`, Next.js scaffolded alongside it | Done, live on Vercel |
| N2 | Screens move to React, one at a time | Done: every page is Next.js |
| N3 | API routes move to Next.js route handlers | Done |
| N4 | Express removed | Done |

**2. v2 features (next).** The scope and decisions are in [docs/v2-audit.md](docs/v2-audit.md).

| Phase | What |
|---|---|
| 1. Foundation | Module toggles (Income, Expenses, Investments, Debts, Cards); money movements that are neither income nor expense (loan disbursement, EMI payment, investment buy and sell, transfers); net savings = income minus expenses, where only loan interest and fees count as expenses |
| 2. Debts | Loans with reducing-balance and flat-rate EMIs, the effective rate, a full amortization schedule, EMI payments (full, partial, late), top-ups, prepayments, missed-payment tracking, and a public EMI calculator |
| 3. Credit cards | Credit lines with one shared limit across cards, statements, billing and due days, and loans on cards |
| 4. Investments | Gold, stocks, crypto and mutual funds; buys and sells; manual price updates; profit and loss; allocation |
| 5. Net worth | Assets minus liabilities, a monthly trend, EMI-to-income and debt-to-asset ratios |
| 6. Public launch | Stronger account recovery, rate limiting on write endpoints, data export and account deletion, PWA, monitoring |

Principles that apply to every phase:
- Money is stored exactly (`bigint` paise for new tables), and multi-table writes are atomic.
- Every table is isolated per user.
- Every change is recorded in the activity log.
- No emoji anywhere.
- The design follows a serious fintech dashboard: Source Sans 3 with tabular numerals, a chart library, and light and dark themes.

## What it does today

- **Accounts:** bank accounts (with starting balance), credit cards (with limit and used amount), cash.
- **Transactions:** income into a bank or cash; expenses paid by cash, bank or card. Adding, editing and deleting an entry updates the account behind it.
- **Monthly summary:** income, expenses, net savings, current wealth, and each account's balance at month end.
- **Activity log:** every change, with old and new values, filters by type and date, and CSV export.
- **Tracking modes:** income only, expenses only, or both, chosen at sign-up.
- **Accounts and security:**
  - username login, 2-hour sessions stored in Postgres;
  - password reset and username lookup by security question, without revealing whether an account exists;
  - bcrypt hashing;
  - rate-limited login in production;
  - Content-Security-Policy and security headers;
  - row level security on every table.

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript (strict) |
| API | Next.js route handlers calling framework-free services in `lib/services/` |
| Database | Supabase Postgres via `pg` (plain SQL) |
| Hosting | Vercel (functions in `syd1`, next to Supabase in `ap-southeast-2`) |
| Tests | Jest (unit, API over HTTP, scripts), Playwright |

## Repository layout

```
app/                  Pages (route groups (public) and (app)), API route handlers (app/api), fintech-theme.css
components/           React components
proxy.ts              Per-request nonce CSP for pages; sends logged-out visitors to /login
next.config.ts        Security headers
lib/                  Server and shared code: db, sessions, rate limits, services/ (accounts, transactions, reports, auth)
setup-db.js           Creates and migrates the schema (tables, indexes, RLS); safe to rerun
reset-test-db.js      Clears the test schema (refuses any schema not ending in _test)
test-helpers.js       Test database helpers
tests/                API suites (Jest over HTTP), tests/unit (TypeScript), tests/e2e (Playwright)
scripts/              run-api-tests.js (starts Next.js on the test schema and runs Jest)
docs/                 API reference, status, v2 audit, migration plan
vercel.json           Framework and region
```

## Getting started

Requirements: Node.js 20.9 or later, and a Supabase project (or any Postgres).

```bash
npm install
```

Create `.env`:

```env
DB_HOST=<supabase pooler host>
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=<password>
DB_SSL=true
SESSION_SECRET=<64-byte hex>
NODE_ENV=development
# Optional: a separate schema for local work; without it you read and write the public schema
DB_SCHEMA=balancetrack_dev
```

Create the tables and start the app:

```bash
npm run setup-db    # creates tables in DB_SCHEMA (public if unset)
npm run dev         # http://localhost:3000
```

> **Warning:** the Supabase database in `.env` also holds production data (schema `public`). Set `DB_SCHEMA` for local development if you do not want to work on production data.

## Testing

All tests run against the `balancetrack_test` schema, never `public`:
- `tests/env.js` forces that schema in Jest;
- every server a test starts gets `DB_SCHEMA=balancetrack_test` and `REQUIRE_TEST_SCHEMA=true`, and then refuses any other schema;
- the cleanup helpers refuse to delete in any schema whose name does not end in `_test`.

```bash
npm test                # build Next.js, start it on :3200, run every Jest project
npm run test:clean      # set up and reset the test schema, then npm test
npm run test:unit       # TypeScript unit tests only (fast; no server or database)
npm run test:e2e        # Playwright user flows against a production build on :3100
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint (JavaScript and TypeScript)
```

| Suite | What it proves |
|---|---|
| Jest `api` | API behaviour over HTTP against the real test schema, including atomic writes, exact balance restoration on edit and delete, per-user isolation and account recovery |
| Jest `unit` | `lib/` in isolation: sessions, rate limits, dates, formatting, routing, security headers |
| Jest `scripts` | `setup-db.js` and the no-emoji rule |
| Playwright | The main user flows end to end |

## Deployment (Vercel + Supabase)

A standard Next.js project on Vercel (`vercel.json` sets the framework and the `syd1` region, next to the Supabase region `ap-southeast-2`).

### Database layout

| Schema | Used by |
|---|---|
| `public` | Production |
| `balancetrack_test` | The test suite |

Every table has row level security enabled with no policies, so Supabase's public Data API cannot read or change them. The app connects as the table owner, which RLS does not restrict.

### Vercel project setup

1. Import the repository in Vercel. The framework (Next.js) and region come from `vercel.json`.
2. Set environment variables (Settings > Environment Variables):

   | Variable | Production | Preview |
   |---|---|---|
   | `DB_HOST`, `DB_PORT` (`6543`), `DB_NAME` (`postgres`), `DB_USER`, `DB_PASSWORD` | Supabase pooler values | Same |
   | `DB_SSL` | `true` | `true` |
   | `SESSION_SECRET` | A 64-byte hex secret | A different secret |
   | `DB_SCHEMA` | Leave unset (uses `public`) | `balancetrack_test`, so previews never touch production data |

   Generate a secret with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. Vercel sets `NODE_ENV=production` itself.
3. Pushing a branch creates a preview; merging to `master` deploys production.

After a deploy, check that:
- `/next-health` returns `{"ok":true,"app":"next"}`;
- `/` redirects to `/login` when logged out, and logging in lands on `/setup`;
- adding a transaction works.

### Notes

- Rate limits count in memory, so each function instance counts separately.
- Sessions are stored in Postgres (`session` table), so they work across instances.
- `.vercelignore` keeps `.env`, `.db-backups/` and the tests out of CLI uploads.

## Documentation

- [docs/v2-audit.md](docs/v2-audit.md): audit of the codebase, risks, and the decisions for v2
- [docs/nextjs-migration-plan.md](docs/nextjs-migration-plan.md): migration strategy and step status
- [docs/API.md](docs/API.md): API reference
- [docs/STATUS.md](docs/STATUS.md): current status and known issues
- [CLAUDE.md](CLAUDE.md): working guide for Claude Code in this repository

## License

`package.json` declares the ISC license. There is no LICENSE file yet.
