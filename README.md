# BalanceTrack

A personal finance tracker for people in India. You enter your money manually: bank accounts, credit cards, cash, income and expenses. BalanceTrack keeps the balances up to date and shows where your money went each month. It does not connect to banks. Amounts are shown in rupees with Indian digit grouping (5,00,000).

## Where it is going

BalanceTrack is being extended into a public personal-finance product. The plan has two tracks, run one after the other.

**1. Move to Next.js (in progress).** The app is moving from plain JavaScript with Express to Next.js, one piece at a time, without changing behaviour. See [docs/nextjs-migration-plan.md](docs/nextjs-migration-plan.md).

| Step | What | Status |
|---|---|---|
| Phase 0 | Atomic writes, activity log inside transactions, audit fixes | Done |
| N0 | Safety net: Playwright user flows, API contract suites | Done |
| N1 | Express moved to `legacy/`, Next.js scaffolded alongside it | Done, live on Vercel |
| N2 | Screens move to React, one at a time | In progress: public pages, auth screens and Account Setup done |
| N3 | API routes move to Next.js route handlers | |
| N4 | Express removed | |

**2. v2 features (after the migration).** The scope and decisions are in [docs/v2-audit.md](docs/v2-audit.md).

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
  - password reset by security question, username lookup by email;
  - bcrypt hashing;
  - rate-limited login in production;
  - Content-Security-Policy and security headers;
  - row level security on every table.

## Tech stack

| Layer | Today | Target |
|---|---|---|
| Frontend | Plain JavaScript modules in `legacy/public/` | Next.js 16 App Router, React 19, TypeScript (strict) |
| API | Express 5 in `legacy/server.js` | Next.js route handlers calling framework-free services in `lib/` |
| Database | Supabase Postgres via `pg` (plain SQL) | Same, plus per-request database-enforced isolation |
| Hosting | Vercel, two services in one project during the migration | Vercel, Next.js only |
| Tests | Jest (backend, frontend, unit), Playwright, API contract suites | Same |

## Repository layout

```
app/                  Next.js app: public pages, auth screens (login, register, recovery, welcome), Account Setup (/setup), /next-health
components/           React components shared by Next.js pages
proxy.ts              Per-request nonce CSP for Next.js pages
lib/                  Framework-free server code for Next.js (TypeScript)
legacy/               Current Express app: server.js, public/ (frontend), lib/, package.json
setup-db.js           Creates and migrates the schema (tables, indexes, RLS); safe to rerun
reset-test-db.js      Clears the test schema (refuses any schema not ending in _test)
test-helpers.js       Test database helpers
tests/                Jest suites, tests/unit (TypeScript), tests/e2e (Playwright)
scripts/              dev.js (runs both apps), run-contract-tests.js
docs/                 API reference, status, v2 audit, migration plan
vercel.json           Vercel Services, rewrites, region, security headers
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

Create the tables and start both apps:

```bash
npm run setup-db    # creates tables in DB_SCHEMA (public if unset)
npm run dev         # Express on :3001, Next.js on :3000; open http://localhost:3000
```

> **Warning:** the Supabase database in `.env` also holds production data (schema `public`). Set `DB_SCHEMA` for local development if you do not want to work on production data.

## Testing

All tests run against the `balancetrack_test` schema, never `public`. `tests/env.js` forces that schema, and the cleanup helpers refuse to delete in any schema whose name does not end in `_test`.

```bash
npm run test:clean      # set up and reset the test schema, then run all Jest projects
npm run test:unit       # TypeScript unit tests (tests/unit)
npm run test:e2e        # Playwright user flows; starts the app on :3100
npm run test:contract   # API contract suites over HTTP; starts the app on :3200, or uses API_BASE_URL
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint (JavaScript and TypeScript)
```

| Suite | What it proves |
|---|---|
| Jest `backend` | API behaviour against the real test schema, including atomic writes and exact balance restoration on edit and delete |
| Jest `frontend` | The legacy frontend modules (jsdom) |
| Jest `unit` | Framework-free TypeScript in `lib/` |
| Playwright | The main user flows end to end, through a local router that applies the `vercel.json` rewrites; used to check each migration step |
| Contract | The same API tests against any running server, so Express and Next.js can be compared |

## Deployment (Vercel + Supabase)

During the migration one Vercel project runs two services (`vercel.json`):
- `web`: Next.js, at the repo root.
- `legacy`: the Express app in `legacy/`, which serves `legacy/public/` from the CDN.

Rewrites send each path to one of them. Today the public pages, the auth screens, `/setup`, `/next-health` and Next.js assets (`/_next/*`) go to `web`; everything else goes to `legacy`. The exact list is the `web` rewrite in `vercel.json`. Functions run in `syd1`, next to the Supabase region (`ap-southeast-2`).

### Database layout

| Schema | Used by |
|---|---|
| `public` | Production |
| `balancetrack_test` | The test suite |

Every table has row level security enabled with no policies, so Supabase's public Data API cannot read or change them. The app connects as the table owner, which RLS does not restrict.

### Vercel project setup

1. Import the repository in Vercel. The services come from `vercel.json`.
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
- `/next-health` returns `{"ok":true,"app":"next"}` (Next.js is routed);
- `/` redirects to `/login` when logged out (Express is routed), and logging in lands on `/setup` (Next.js);
- logging in and adding a transaction works.

### Notes

- The login rate limit counts in memory, so each function instance counts separately.
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
