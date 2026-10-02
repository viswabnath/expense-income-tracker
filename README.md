# FinDB

FinDB (Finance Dashboard) is a personal finance tracker for people in India. You record your money yourself: bank accounts, credit cards, cash, income and expenses. FinDB keeps every balance up to date and shows where your money went each month. It never connects to your bank. Amounts are in rupees with Indian digit grouping (5,00,000.00).

## Features

- **Accounts:** bank accounts with a starting balance, credit cards with a limit and the amount used, and cash.
- **Transactions:** income into a bank or cash, and expenses paid by cash, bank or card. Adding, editing or deleting an entry updates the account behind it. Users who also track income cannot overspend an account.
- **Monthly summary:** income, expenses, net savings, total wealth, and each account's balance at the end of the month.
- **Activity log:** every change with its old and new values, filters by month and year, paging, and CSV export.
- **Tracking modes:** income only, expenses only, or both, chosen at sign-up.
- **Accounts and security:**
  - username and password login with 2-hour sessions;
  - account recovery by security question that does not reveal whether an account exists, and pauses after repeated wrong answers;
  - bcrypt password hashing and rate-limited login;
  - a Content-Security-Policy and standard security headers on every response;
  - every query limited to the signed-in user, and row level security on every table.

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| API | Next.js route handlers in `app/api`, with the logic in `lib/services` |
| Database | PostgreSQL (Supabase) through `pg`, plain SQL |
| Hosting | Vercel |
| Tests | Jest and Playwright |

## Project structure

```
app/            Pages, API route handlers (app/api) and the stylesheet
components/     React components
lib/            Server and shared code: database, sessions, rate limits, services
proxy.ts        Per-request Content-Security-Policy; sends signed-out visitors to /login
next.config.ts  Security headers
setup-db.js     Creates and updates the database schema (safe to rerun)
tests/          API tests, unit tests (tests/unit) and end-to-end tests (tests/e2e)
docs/           API reference and project status
```

## Getting started

Requirements: Node.js 20.9 or later, and a PostgreSQL database (for example a Supabase project).

```bash
npm install
```

Create a `.env` file:

```env
DB_HOST=<database host>
DB_PORT=6543
DB_NAME=postgres
DB_USER=<database user>
DB_PASSWORD=<password>
DB_SSL=true
SESSION_SECRET=<64-byte hex string>
# Optional: the Postgres schema to use (default: public)
DB_SCHEMA=findb_dev
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Create the tables and start the app:

```bash
npm run setup-db    # creates the tables in DB_SCHEMA (public if unset)
npm run dev         # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run setup-db` | Create or update the tables |
| `npm test` | Build the app, start it against the `balancetrack_test` schema, and run all Jest tests |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run test:e2e` | End-to-end browser tests (Playwright) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint checks |

Tests always use the `balancetrack_test` schema and refuse to run against any other, so they never touch real data. Create it once with `npm run setup-test-db`.

## Deployment

FinDB runs on Vercel as a standard Next.js project (`vercel.json` sets the region, `syd1`).

1. Import the repository in Vercel.
2. Add the environment variables from `.env` (Settings > Environment Variables). Use a different `SESSION_SECRET` per environment, and set `DB_SCHEMA=balancetrack_test` for previews so they never touch production data.
3. Run `npm run setup-db` once against the production database.

Pushing a branch creates a preview deployment; merging into `master` deploys production.

## Documentation

- [docs/API.md](docs/API.md): API reference
- [docs/STATUS.md](docs/STATUS.md): current status and known issues

## License

ISC (declared in `package.json`).
