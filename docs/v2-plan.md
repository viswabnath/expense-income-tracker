# FinDB v2 plan

_Drafted 2026-10-03. Status: **proposed, awaiting approval.** Nothing in this plan is built yet. Each phase starts only after it is approved, and each phase ends with a full test run and a reviewed pull request._

v2 turns FinDB from an income-and-expense tracker into a full personal finance dashboard. It adds loans, money lent to or borrowed from people, credit lines, investments with live prices, deposits and goals, spending insights, and net worth. FinDB stays manual and private: the user enters their own data, and FinDB never connects to a bank. The only outside connections are optional price feeds, and a broker connection only if the user chooses it.

This plan combines the original v2 brief (see `docs/v2-audit.md`) with the additions agreed on 2026-10-03:
- money lent and borrowed with people, and split costs;
- recurring and fixed deposits, and savings pots;
- short-term and long-term goals;
- a ranking of the most dangerous debts, with payoff plans;
- live prices;
- spending categories and insights;
- repeating entries, reminders, insurance, a tax tracker and an emergency fund check.

## Rules for every phase

- **Exact money.** New tables store amounts as `bigint` paise (₹12.50 is `1250`). Existing `DECIMAL(20,2)` columns stay; they are exact. A shared money module reads them into paise by parsing the string, never through floating point. Moving old columns to paise is a separate migration, if wanted later.
- **Atomic writes.** Any change touching more than one row runs in one transaction (`withTransaction`), with rows locked when they are checked or changed.
- **Per-user isolation enforced by the database.** Each request runs its queries in a transaction that sets `app.user_id`. Row level security policies on every user table allow only rows where `user_id = current_setting('app.user_id')::int`. This is the decision recorded on 2026-09-30, and it arrives with the Phase 1 data model. Queries also keep their own `user_id` filters.
- **Every change is logged** in the activity log, in the same transaction as the change.
- **Only the user's own accounts.** Every entry checks that the accounts it uses belong to the user (as `requireOwnAccount` does today).
- **Migrations.** Each phase ships its database changes as numbered SQL files for the owner to apply (the decision recorded on 2026-09-30). Tests run them on the `balancetrack_test` schema first.
- **No emoji anywhere**; names and messages are rendered as text.
- **Not financial advice.** Insights, rankings and simulations are rule-based calculations and general explanations. Screens that rank debts or suggest payoff plans say so clearly.
- **Tests per phase:**
  - unit tests for every calculation (EMIs, schedules, maturity values, goal projections, ratios);
  - API tests over HTTP for every route, including isolation between users;
  - Playwright flows for the main screens;
  - one full run at the end of the phase.

## Overview

| Phase | Name | What the user gets |
|---|---|---|
| 1 | Foundation | New design, module switches, transfers and other non-income money movements, expense categories and tags, repeating entries, database-enforced isolation |
| 2 | Spending insights and budgets | Category averages, subscription finder, trips, budgets with alerts, unusual-spend flags |
| 3 | Debts and people | Loans with EMIs and schedules, money lent to or borrowed from people, split costs, dangerous-debt ranking, payoff plans |
| 4 | Credit cards | Shared credit lines, statements with billing and due dates, loans on cards, card warnings |
| 5 | Investments | Gold, Sovereign Gold Bonds, stocks, mutual funds, crypto; buys and sells; profit and loss; allocation; live prices |
| 6 | Savings and goals | Recurring and fixed deposits, savings pots, short-term and long-term goals |
| 7 | Net worth and financial health | Net worth with a trend, health ratios, emergency fund check, insurance policies, tax-saving tracker |
| 8 | Public launch | Email-based account recovery, reminders by email, rate limits on all writes, data export and account deletion, installable app, monitoring |

Phase 2 comes early on purpose. It needs only Phase 1's categories, and it gives users value straight away.

---

## Phase 1: Foundation

**Design system**
- Source Sans 3 with tabular numerals, so amounts line up in columns.
- Light and dark themes built from CSS tokens.
- Borders instead of shadows; no blurred see-through panels, no gradients.
- A chart library, installed from npm and bundled, so the Content-Security-Policy stays strict.
- Shared components: cards, tables, forms, dialogs, amount display.
- Every existing screen moves to the new design. The new screens of later phases are built in it from the start.

**Module switches**
- In Settings, the user turns Income, Expenses, Investments, Debts and Cards on or off. This replaces the single sign-up choice (`tracking_option`), and existing users are mapped from it: income only, expenses only, or both.
- Turned-off modules disappear from navigation and screens. The API keeps their data, and switching a module back on shows it again.

**Money movements that are not income or expenses**
- A general "movement" record with a type:
  - transfer between own accounts;
  - loan payout and loan repayment (principal);
  - investment buy and sell;
  - deposit in and out;
  - lent to and repaid by a person.
- Movements change balances but never count as income or spending.
- **Net savings = income - expenses**, where expenses include loan interest and fees but not principal. The monthly summary is rebuilt on this rule. That also fixes the known issue about accounts created on the last day of a month.

**Expense categories and tags**
- Every expense has a category. Defaults: Rent, Groceries, Restaurants and food delivery, Fuel, Transport, Subscriptions, Movies and entertainment, Shopping, Health, Education, Travel, Bills and utilities, Insurance, Gifts, Personal care, Other.
- Users can rename categories and add their own.
- **Suggested category from the title,** with a built-in keyword list (for example "Swiggy" means restaurants, "HP Petrol" means fuel) that learns from the user's own past choices.
- **Tags** for things that cut across categories, such as "Goa trip 2026" or "Wedding".
- Existing expenses start as "Uncategorised" and can be categorised later, in bulk.
- Income gets simple categories too: salary, freelance, interest, refund, gift, other.

**Repeating entries**
- Salary on the 1st, rent on the 5th, monthly SIPs.
- A schedule (monthly, weekly or yearly, on a given day).
- Each entry is either added automatically or shown for one-tap confirmation, as the user chooses.

**Data model (new tables, amounts in paise)**
- `user_modules`
- `categories`
- `tags` and `entry_tags`
- `movements`
- `recurring_entries`
- New columns: `category_id` on expenses and income.
- RLS policies with `app.user_id` on every user table, old and new.

**Done when**
- the new design is on every screen in both themes;
- switches hide and show modules;
- a transfer and a loan payout do not change income or expenses;
- the summary shows true net savings;
- categories are suggested and editable;
- repeating entries fire on schedule;
- a test proves one user cannot read another user's rows even with the query's `user_id` filter removed.

## Phase 2: Spending insights and budgets

- **Category averages:** "Restaurants: ₹6,800 a month on average over the last 3, 6 or 12 months, up 22%."
- **Subscription finder:** expenses that repeat with a similar amount and spacing are flagged as subscriptions. It shows the monthly and yearly total, a new subscription, a price increase, and one that stopped.
- **Trips and events:** a tag's total, broken down by category ("Goa trip: ₹42,300 = travel ₹14,000, stays ₹16,500, food ₹8,900, other ₹2,900").
- **Top categories and month-on-month changes**, as charts.
- **Budgets:** a monthly limit per category, with progress and an in-app alert at 80% and 100%.
- **Unusual-spend flags:** "Fuel this month is twice your average."

Data: `budgets`. The averages are computed from existing data, with no new storage.

## Phase 3: Debts and people

**Loans from banks and lenders**
- Reducing-balance and flat-rate loans, with the effective yearly rate shown for both.
- A full repayment schedule: interest, principal and balance for every EMI.
- EMI payments recorded as full, partial or late. Missed EMIs are flagged.
- Prepayments, which either shorten the term or lower the EMI, with the interest saved shown. Top-ups.
- An EMI paid from a bank splits automatically into principal (a movement) and interest (an expense in "Loan interest and fees").
- **A public EMI calculator,** usable without an account.

**Money with people**
- A "People" ledger: money lent and borrowed, interest-free or with interest, an optional due date, and repayments in parts.
- Each loan shows as open, overdue or settled.
- Lending and repayments are movements, not income or spending. What others owe counts as an asset in net worth; what the user owes counts as a liability.
- **Split costs:** "Dinner ₹3,600 split 3 ways" records the user's share as the expense and creates "owes you" entries for the others.

**Which debt is most dangerous**
- Debts are ranked by their true yearly cost, with a plain-language explanation of each type:
  - a revolving credit card balance;
  - buy-now-pay-later and instant loan apps, with fees and penalties counted in;
  - personal and card loans;
  - vehicle loans;
  - home loans.
- **Payoff simulator:** given an extra amount per month, the highest-rate-first plan (avalanche) is compared with the smallest-balance-first plan (snowball). For each it shows the interest saved and the debt-free date, side by side.
- **Warnings:**
  - paying only the minimum due;
  - EMIs above a set share of income;
  - overdue loans from people.
- Every screen notes that this is information, not financial advice.

Data: `loans`, `loan_payments`, `people`, `person_loans`, `person_loan_payments`, `splits`. Schedules are computed, not stored.

## Phase 4: Credit cards

- **Credit lines:** one shared limit across several cards, matching how banks set it.
- **Statements:** each card has a billing day and a due day. Each cycle produces a statement with the amount due, the minimum due and the due date. Payments are matched to statements.
- **Loans on a card:** EMIs that reduce the card's available limit, built on the Phase 3 loan engine.
- **Reminders and warnings:** due dates, minimum-only payments, and interest charged on a balance carried over.
- Existing cards move into credit lines of one card each.

Data: `credit_lines`, `card_statements`, plus new columns on `credit_cards`.

## Phase 5: Investments

- **Holdings:**
  - gold (grams);
  - Sovereign Gold Bonds (units, issue price, interest rate, maturity);
  - stocks;
  - mutual funds (units, SIPs);
  - crypto.
- Buys and sells are movements. Average cost and realised and unrealised profit and loss are calculated.
- **Allocation:** how invested money is spread across types, as a chart.
- **Prices:** always editable by hand, and every price shows its date and source.
  - **Live prices (optional add-on):** a scheduled server job (Vercel Cron) fetches prices once a day and stores them. The browser never calls price services directly.

    | Asset | Planned source | Note |
    |---|---|---|
    | Mutual funds | AMFI's daily published NAVs | Official and free |
    | Crypto | CoinGecko public API | Free tier, rate limits, attribution required |
    | Gold and Sovereign Gold Bonds | A published daily gold rate or a paid metals feed | Terms to be checked before automating |
    | Stocks | A paid data provider, or the user's own broker API (for example Upstox or Zerodha Kite Connect) connected with their permission | Exchange data needs a licence; scraping exchange sites is not allowed. Manual entry is the fallback. |

  - The first release covers mutual funds and crypto. Gold follows once a source with suitable terms is chosen, and stocks through a broker connection after that.

Data: `holdings`, `investment_transactions`, `prices`, `price_sources`.

## Phase 6: Savings and goals

**Deposits**
- **Recurring deposits:** monthly instalment, rate, start date, tenure. The maturity date and value are calculated, and instalments are tracked as paid or missed.
- **Fixed deposits:** amount, rate, compounding, maturity, and interest earned so far.
- A reminder before a deposit matures.

**Savings pots:** money set aside inside a bank account for a purpose, without moving it.

**Goals**
- **Short-term and long-term goals:** a name, target amount and target date. For example: dream bike ₹2,20,000 by June 2028, emergency fund of 6 months' spending, house down payment ₹20,00,000 by 2032, or clearing a loan early.
- Goals are funded by any mix of deposits, pots, investments or monthly contributions.
- **For each goal:**
  - progress as a percentage;
  - the monthly amount still needed;
  - whether it's on track, behind or ahead;
  - what-ifs, such as "add ₹2,000 a month to reach it 4 months earlier".
- A "clear this loan" goal links to a Phase 3 loan and uses the payoff simulator.

Data: `deposits`, `deposit_instalments`, `pots`, `goals`, `goal_sources`.

## Phase 7: Net worth and financial health

- **Net worth** = everything owned minus everything owed:
  - owned: banks, cash, deposits, investments, and money others owe the user;
  - owed: loans, card dues, and money the user owes others.
- A month-end snapshot builds a **trend chart**.
- **Health ratios:**
  - EMI-to-income;
  - debt-to-assets;
  - savings rate;
  - emergency fund coverage, in months of average spending.
- **Insurance policies:** type, insurer, cover amount, premium, frequency, renewal date, and reminders.
- **Tax-saving tracker (India):** progress toward the section 80C limit from PPF, ELSS, life insurance premiums, home loan principal and tuition fees. It applies only under the old tax regime, so it asks which regime the user follows. Information only.

Data: `net_worth_snapshots`, `insurance_policies`, `tax_profile`.

## Phase 8: Public launch

- **Account recovery by an emailed link,** replacing the security question. Registration stops revealing whether an email is in use. Both need an email provider.
- **Reminders by email** as well as in the app: EMIs, card due dates, deposit maturities, insurance renewals, overdue money from people.
- **Rate limits on every write,** and a shared rate-limit store so the limits hold across server instances.
- **Data export** (every table, as CSV or JSON) and **account deletion**.
- **Installable app (PWA).**
- **Error monitoring.**

---

## Decisions needed before or during the phases

| When | Decision |
|---|---|
| Before Phase 1 | Approve this plan, the default category list, and the module mapping from `tracking_option` |
| Before Phase 1 | The test-run database stalls (STATUS): check the Supabase pooler's connection limit, or use a direct connection for tests |
| Phase 1 | Whether repeating entries default to automatic or to confirm-first |
| Phase 5 | Price sources and any paid plans (gold, stocks), and whether to offer broker connections |
| Phase 7 | Whether to include the tax tracker, given the old and new regimes |
| Phase 8 | The email provider |
