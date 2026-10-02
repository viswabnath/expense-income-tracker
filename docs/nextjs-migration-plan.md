# Next.js migration plan

_Drafted 2026-09-30, after Phase 0 (`c03c72b`). Nothing in this plan is implemented yet._

## Goal and constraints

Move BalanceTrack from plain JavaScript plus Express to Next.js (App Router, TypeScript) on Vercel, without changing behaviour. Specifically:

- **Same behaviour.** Every screen and API response works as it does today. Known bugs are carried over unchanged and fixed separately (see the audit).
- **Nobody is logged out.** Sessions created by Express keep working after each route moves.
- **No data changes.** The migration touches code only. The database schema, including the `session` table, stays as it is.
- **Deployable at every step.** Each step ships to production on its own. There is never a long-lived branch holding half an app.

Versions at time of writing: Next.js 16.3.7 (requires Node 20.9+), React 19.3, TypeScript 7.0, Playwright 1.63.

## Strategy: replace piece by piece, not all at once

Rewriting 31 API routes and 10 screens in one go would leave nothing to compare against until the end. Instead, the Next.js app and the existing Express API run side by side in **one Vercel project**, using Vercel Services:

```json
{
  "services": {
    "web": { "root": "./" },
    "legacy_api": { "root": "legacy/", "framework": "express" }
  },
  "rewrites": [
    { "source": "/(setup|transactions)", "destination": { "service": "web" } },
    { "source": "/(.*)", "destination": { "service": "legacy_api" } }
  ]
}
```

At first everything still goes to the legacy service, which serves both the old pages and `/api`. Each migration step adds one rule sending a path to Next.js: first screens (as in the example), then API route groups. When the legacy service no longer receives anything, Express is deleted.

Both services sit under one domain, so the session cookie (`sessionId`, `SameSite=strict`) reaches both without changes.

## Target layout (no monorepo)

```
app/                    Next.js App Router
  (auth)/login, register, forgot-username, forgot-password
  (app)/setup, transactions, summary, activity, welcome
  (public)/about, security, privacy, terms
  api/...               Route handlers (thin: parse request, call lib, return JSON)
components/             React components built on the design tokens
src/core/               Framework-free financial logic (money, EMI, schedules...), per the brief
lib/                    Server-only, framework-free: db pool, transaction.ts, session.ts,
                        rate-limit.ts, services/ (accounts, transactions, summary, activity)
styles/tokens.css       Design tokens (Source Sans 3, light/dark)
proxy.ts                CSP nonce and security headers
legacy/                 Express app + old public/ during the migration; deleted at the end
tests/
  api/                  API contract tests (real DB, test schema), run against either implementation
  e2e/                  Playwright tests of real user flows
  unit/                 src/core and lib unit tests
```

The rules the brief asks for:
- `src/core` imports nothing from React, Next.js, `pg` or Supabase.
- `lib/` imports nothing from Next.js.
- Route handlers stay under about 20 lines each, with the logic in `lib/services`.

## Steps

Each step ends with every test passing, a production deploy, and a stop for approval.

### N0. Safety net (before any migration code)
Status: done.

1. **Playwright flows** (`tests/e2e/`, `npm run test:e2e`), all 6 passing against the current app:
   - account setup;
   - income and expense add, edit and delete, with balance checks;
   - monthly summary, activity feed and CSV export;
   - logout and login;
   - forgot username;
   - forgot password.

   The flows found one real bug: the first click on "Continue" in the password reset did nothing. It is fixed in `b16684d`.
2. **API contract suites.** `integration`, `atomic-writes`, `edge-cases`, `bank-deletion-fix` and `cash-balance-activity` send requests through `tests/api-target.js`. That means the in-process Express app by default, or a running server when `API_BASE_URL` is set. `npm run test:contract` starts `server.js` on port 3200 and runs them over HTTP.
3. **Retired with Express (N4)**, because these tests cannot check a new implementation:
   - They mock `pg` and cover `server.js` internals: `activity-endpoint`, `comprehensive-server-coverage`, `server-edge-coverage`, `setup-db`, `setup-db-coverage`.
   - They test copies of code defined inside the test file instead of the real code: `api.test.js` (a copied `ApiClient`), `server.test.js` (a separate mini Express app).
   - `security-middleware` loads Express under different environments. It is replaced by header and CSP tests against Next.js in N4.

### N1. Scaffold alongside Express
Status: done.

What was done:
- `server.js`, `public/` and `lib/transaction.js` moved to `legacy/` with `git mv`, with no code changes. `setup-db.js`, `reset-test-db.js` and `test-helpers.js` stayed at the root, because they are database tooling the Next.js side also uses.
- Next.js 16.3.7, React 19.3 and TypeScript 6.0 in strict mode are set up. TypeScript 7.0 was not used: `typescript-eslint` supports only TypeScript below 6.1.
- `lib/transaction.ts` has unit tests in the new `unit` Jest project. `vercel.json` defines the two Services, `legacy/package.json` holds the Express runtime dependencies, and `npm run dev` runs both apps.

Verified locally:
- `next build`, `tsc --noEmit` and lint all pass.
- All Jest suites (342 tests) pass, and the 5 contract suites pass against `legacy/server.js` over HTTP.
- All 6 Playwright flows pass directly against Express and also **through** `next dev` forwarding to Express, which checks that session cookies survive the pass-through.

Deployed on 2026-09-30 (Vercel project `balancetrack`, PR #8):
- The preview passed every check: `/next-health` from Next.js; `/`, register, add bank and income, and logout from Express; writes went to `balancetrack_test`.
- Production (`master`, `9e29ef5`) passed read-only checks: `/next-health`, `/`, `/api/*` requiring login, and the HTTP to HTTPS redirect.

Note: a Git deployment created through the API for a brand-new project was targeted at production, even for a non-production branch. It was cancelled before going live. Use `vercel deploy` (preview by default) or a Git push for previews.

- `git mv` `server.js`, `public/`, `setup-db.js`, `reset-test-db.js` and `test-helpers.js` into `legacy/`, and update require paths. No code changes.
- Add Next.js 16 (App Router, TypeScript, strict mode) at the repo root. Add the Services config and rewrites above. Configure ESLint and `tsc --noEmit`.
- Convert `lib/transaction.js` to TypeScript with the same behaviour. It is shared by both apps until Express is removed.
- Local development: `next dev` on port 3000 with a rewrite of `/api/*` to Express on port 3001.
- **Exit:** with only the catch-all rewrite to the legacy service, the deployed site behaves exactly as before, and all tests pass. The Next.js app is deployed but receives no traffic yet.

### N2. Screens to React (Express API unchanged)
Progress:
- **Public pages (done):** `/about`, `/security`, `/privacy`, `/terms` are Next.js pages in `app/(public)`, public without login.
  - They reuse the legacy CSS and markup classes, with Inter self-hosted through `next/font` and icons from `lucide-react`.
  - `proxy.ts` gives them a per-request nonce CSP (`lib/csp.ts`).
  - The legacy footer links to them as real URLs, and their sections were removed from `legacy/public/index.html`.
  - Playwright now runs a production build of Next.js that forwards to Express.
  - Found while porting: `fintech-theme.css` had stray declarations that made browsers drop the `#transactions-history` rule. Both were removed, so the look is unchanged and the file is valid CSS.
- **Auth screens (done):** `/login`, `/register`, `/forgot-username`, `/forgot-password` (both steps) and `/welcome` (the tracking choice after sign-up) are Next.js pages calling the unchanged Express API.
  - They keep the legacy element ids and `data-action` hooks, so the 6 existing Playwright flows pass unchanged through them.
  - Validation rules and messages are shared in `lib/auth-validation.ts`, with unit tests.
  - The focus-help behaviour is kept, and the first-click fix is built into `AuthButton`.
  - The username is filled in after "forgot username", via sessionStorage rather than the URL.
  - Logged-out visits to `/` now redirect to `/login`; the legacy auth forms are hidden and unused until N4.
  - Deliberate differences: `/welcome` shows an error if saving the tracking option fails (legacy failed silently), and toasts render text, never HTML.
- **Account Setup (done):** `/setup` is the first logged-in Next.js screen (`app/(app)`).
  - `AppShell` reproduces the nav bar, mobile sidebar, logout confirmation and loading overlay. Nav links go to `/setup` or to the legacy app's `/?section=...`, which it now reads.
  - `proxy.ts` sends visitors without a `sessionId` cookie to `/login`; an expired session is caught by the page's first 401.
  - The legacy Setup section and its four dialogs are removed; `setupManager.loadSetupData()` is a no-op there.
  - Login and the tracking choice now land on `/setup`.
- **Test harness:** Playwright now runs Next.js exactly as on Vercel, without a fallback proxy, behind `scripts/services-router.js`, which applies the `vercel.json` rewrites. Next.js's built-in fallback proxy produced intermittent `ECONNRESET`s.
- **Found while porting:** the connection-leak bug in three bank and card routes (see STATUS), and the pre-hydration click race on the auth screens.
- **Transactions (done):** `/transactions` is a Next.js page with the same filters, forms, history tables, edit and delete dialogs and messages as before.
  - Sources, titles and account names render as text; the legacy tables inserted them as HTML.
  - Legacy quirks kept on purpose, to change in the redesign: the date inputs default to the UTC date, save failures in the edit dialogs show a generic message instead of the API's reason, and dates are shown in the browser's locale.
  - The legacy Transactions section and its three dialogs are removed; the legacy nav links and `showSection('transactions')` load `/transactions`.
  - `lib/dates.ts` holds the date helpers (unit tested); `components/useFormMessage.ts` is shared with Setup.
- **Monthly Summary (done):** `/summary` is a Next.js page with the same month and year controls, cards, account balances, calculation breakdown and "no data" messages.
  - Bank and card names render as text; the legacy screen inserted them as HTML.
  - It opens on the current month, like the legacy section.
  - The year list now matches the Transactions filter (2020 to next year). The legacy app filled it twice, with 2020 or five years back depending on which script ran last.
  - No charts yet: they come with the redesign, using the chosen chart library.
  - The legacy Summary section is removed; legacy links and `showSection('summary')` load `/summary`.
- **Activity (done, N2 complete):** `/activity` is a Next.js page.
  - **Paging now comes from the server, 10 entries per page.** The legacy feed loaded only the API's first page of 20 and paged that locally, so older entries were unreachable.
  - The API's total and page counts now follow the filters; they used to count every entry.
  - **Clear** reloads everything. It used to redisplay the last filtered results.
  - Month is disabled until a year is chosen, because the API filters by month only together with a year.
  - Entries from the recovery fix have their own labels: "Recovery Attempt Failed" and "Password Reset".
  - The labels live in `lib/activity.ts`, which is unit tested.
- **`/` is Next.js too:** `proxy.ts` sends visitors without a session cookie to `/login`, old `/?section=...` links to the matching page, and everyone else to `/setup`.
- **The legacy frontend can no longer be reached** except as `/index.html`, which redirects to the Next.js pages. Its files and their Jest frontend tests are deleted with Express in N4.

Port one screen per step, each behind its Playwright test. The first ones use the existing `fintech-theme.css` so nothing changes visually. The redesign is a separate later pass, as the brief requires.

| Old section | New route | Old module(s) |
|---|---|---|
| auth-section | `/login`, `/register`, `/forgot-username`, `/forgot-password` | `auth.js` |
| welcome-section | `/welcome` | `auth.js` (tracking choice) |
| setup-section | `/setup` | `setup-manager.js` |
| transactions-section | `/transactions` | `transaction-manager.js` |
| summary-section | `/summary` | `summary-manager.js` |
| activity-section | `/activity` | `activity-manager.js` |
| about / security / privacy / terms | `/about`, `/security`, `/privacy`, `/terms` | static HTML |

Other changes in this step:
- Each section becomes a real URL, so the browser back button and deep links start working. That is the only behaviour addition.
- `navigation-manager.js`, `event-handlers.js`, `initialization.js`, `module-validator.js` and `toast-manager.js` are replaced by the Next.js layout, React events and one toast component.
- `api.js` becomes a typed fetch client.

### N3. API routes to route handlers (group by group)
Each group moves its logic from `legacy/server.js` into `lib/services/*.ts`, adds thin handlers under `app/api`, and adds a rewrite sending its paths to the web service. The contract suite runs against both implementations before the switch.

| Group | Routes | Notes |
|---|---|---|
| Session and auth | `POST register, login, logout, forgot-username, forgot-password, reset-password`; `GET user`; `POST set-tracking-option` | Needs `lib/session.ts` (below) and `lib/rate-limit.ts` |
| Accounts | `GET/POST banks`, `PUT/DELETE banks/:id`, `GET/POST credit-cards`, `PUT/DELETE credit-cards/:id`, `GET/POST cash-balance` | |
| Transactions | `GET/POST income`, `GET/PUT/DELETE income/:id`, `GET/POST expenses`, `GET/PUT/DELETE expenses/:id` | Keep `withTransaction` and `FOR UPDATE` exactly |
| Reports | `GET monthly-summary`, `GET activity` (including CSV export) | |

Route handlers use the Node.js runtime, never Edge, because `pg` and bcrypt need Node APIs.

**Order:** accounts, then transactions, then reports, then auth last. Auth is last because while any Express route remains, both apps must read the same session, and moving auth last keeps session creation in Express until the end.

### N4. Remove Express
- Delete `legacy/`, the Services config and rewrites (Next.js becomes a plain project again) and the mocked-`pg` tests.
- Move security headers from `vercel.json` into `proxy.ts` and `next.config.ts` (below).
- Update the README, `CLAUDE.md` and `docs/API.md`.

## Sessions: staying compatible

Express signs the cookie as `s:<sid>.<HMAC-SHA256 of sid with SESSION_SECRET>` and stores the session in the `session` table (`sid`, `sess` JSON with `cookie` and `userId`, `expire`). `lib/session.ts` reimplements the parts in use:
- **Read:** verify the signature with `cookie-signature` (the same package Express uses), then `SELECT sess FROM session WHERE sid = $1 AND expire > now()`.
- **Create (login and register):** generate a new `sid`, which also covers the current session-fixation regeneration. Insert the row with the same JSON shape and a 2-hour expiry, and set a `sessionId` cookie with `httpOnly`, `SameSite=strict` and `Secure` in production.
- **Destroy (logout):** delete the row and clear `sessionId`. This also fixes the audit finding where logout cleared the wrong cookie name.

Unit tests prove the round trip in both directions: a cookie signed by `express-session` is accepted by `lib/session.ts`, and one signed by `lib/session.ts` is accepted by `express-session`. That compatibility is what lets both apps run at once.

## Security headers and CSP

- Next.js needs inline scripts to load pages in the browser, so the current `script-src 'self'` policy would block the app. `proxy.ts` generates a nonce per request and sends `script-src 'self' 'nonce-<n>' 'strict-dynamic'`, and Next.js applies that nonce to its own scripts. The catch is that nonce pages must be rendered per request. This app's pages are all personal data, so they would be rendered per request anyway.
- The chart library (decision 6) is installed from npm and bundled, so no external script origin is needed. Lucide becomes the `lucide-react` package, which lets `https://unpkg.com` be removed from the policy.
- The other headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`) move to `next.config.ts` `headers()`. A test checks them, like the current `vercel.json` parity test.
- The production HTTP to HTTPS redirect is dropped. Vercel already serves HTTPS only.

## Rate limiting

`express-rate-limit` does not work in route handlers. `lib/rate-limit.ts` gives the same behaviour (5 failed auth attempts per 15 minutes per IP, 100 requests per minute) with the same in-memory, per-instance limits as today, so nothing regresses. It is written behind an interface, so a shared store (for example Upstash Redis) can replace it later without touching the handlers.

## Testing

| Suite | Runs against | Purpose |
|---|---|---|
| Playwright e2e | Deployed preview and local | The same user flows before and after every step |
| API contract (Jest, real DB test schema) | Express and Next.js via base URL | Same responses, balances and activity log entries |
| Unit (`src/core`, `lib`) | In process | Money math, sessions, transactions, rate limiting |
| `tsc --noEmit`, ESLint, `next build` | CI | The brief's type-check, lint and build requirements |

The existing protections stay: the test schema guard, the no-emoji test and the no-`pool.query('BEGIN')` guard.

## Risks

| Risk | Mitigation |
|---|---|
| Users logged out mid-migration | Session format compatibility, proven by the round-trip tests |
| Behaviour drift while porting screens | Playwright flows written against the old app first |
| Vercel Services is a newer feature | Before N1, deploy the Services config to a preview first. Fallback: a Next.js `rewrites()` fallback to the Express deployment URL |
| Every page rendered per request because of CSP nonces | Acceptable for a logged-in finance app. Public pages (about, terms) can stay static by leaving them out of the nonce policy |
| Two copies of a route during N3 | Each group switches in one deploy. The contract suite must pass on both before the rewrite is removed |
| Migration drags on | Every step deploys on its own and is useful alone. No long-lived branch |

## Open questions

1. **Expenses-only users:** decided, balances always change. Fixed before N0.
2. **Public pages:** decided, `/about`, `/security`, `/privacy` and `/terms` become public (no login) when they move to Next.js in N2.
3. **Order relative to v2 Phase 1:** decided, the migration (N0–N4) finishes before v2 Phase 1 starts.
