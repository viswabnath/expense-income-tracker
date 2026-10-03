# FinDB v2 plan

_Drafted 2026-10-03. Status: **proposed, awaiting approval.** Nothing in this plan is built yet. Each phase starts only after it is approved, and each phase ends with a full test run and a reviewed pull request._

v2 turns FinDB from an income-and-expense tracker into a full personal finance dashboard. It adds loans, money lent to or borrowed from people, credit lines with cashback and rewards, meal cards and wallets, investments (including daily and monthly SIPs) with live prices, deposits and post office schemes, retirement savings (EPF, NPS), land, property and rentals, vehicles and other physical assets, insurance, goals, spending insights, net worth, and a review of whether the user's finances are heading the right way against inflation and the market. FinDB stays manual and private: the user enters their own data, and FinDB never connects to a bank. The only outside connections are optional price feeds, and a broker connection only if the user chooses it.

This plan combines the original v2 brief (see `docs/v2-audit.md`) with the additions agreed on 2026-10-03:
- money lent and borrowed with people, and split costs;
- recurring and fixed deposits, and savings pots;
- short-term and long-term goals;
- a ranking of the most dangerous debts, with payoff plans;
- live prices;
- spending categories and insights;
- repeating entries, reminders, insurance, a tax tracker and an emergency fund check.

And on 2026-10-03, later the same day:
- gold bought by SIP, daily or monthly;
- credit card cashback and reward points;
- meal cards (Pluxee, formerly Sodexo, and similar) and wallets;
- the National Pension System (NPS), including employer contributions;
- the Employees' Provident Fund (EPF) and Voluntary Provident Fund (VPF);
- term and health insurance;
- post office and government savings schemes (PPF, Sukanya Samriddhi, NSC, KVP, MIS, SCSS, post office RD and time deposits);
- a payslip entry that splits one salary into its parts.

And, also on 2026-10-03:
- physical gold valued by weight and purity at the day's rate;
- land and property, with rents from homes and commercial property as income;
- fixed deposit interest as income, paid out or accumulated;
- vehicles and other physical assets that lose value over time (depreciation);
- a financial status review: whether each part of the user's finances is heading the right way compared with inflation and the market.

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
| 1 | Foundation | New design, module switches, meal cards and wallets as accounts, transfers and other non-income money movements, expense categories and tags, repeating entries (daily to yearly), database-enforced isolation |
| 2 | Spending insights and budgets | Category averages, subscription finder, trips, budgets with alerts, unusual-spend flags |
| 3 | Debts and people | Loans with EMIs and schedules, money lent to or borrowed from people, split costs, dangerous-debt ranking, payoff plans |
| 4 | Credit cards | Shared credit lines, statements with billing and due dates, loans on cards, cashback and reward points, card warnings |
| 5 | Investments | Physical gold by weight and purity, digital gold (including daily or monthly SIP), Sovereign Gold Bonds, stocks, mutual funds, crypto; SIPs; buys and sells; profit and loss; allocation; live prices |
| 6 | Property, rentals and physical assets | Land, houses and commercial property with their value over time; tenants and rent as income; vehicles and other assets with depreciation |
| 7 | Savings, retirement and goals | Recurring and fixed deposits, post office and government schemes (PPF, SSY, NSC, KVP, MIS, SCSS), EPF and VPF, NPS with employer contributions, the payslip entry, savings pots, short-term and long-term goals |
| 8 | Net worth, insurance and tax | Net worth with a trend, health ratios, emergency fund check, term and health insurance, tax-saving tracker (80C, 80CCD, 80D) |
| 9 | Financial status review | Whether each part of the user's finances is heading the right way: returns against inflation, net worth growth after inflation, allocation, liquidity, debt, insurance and rental yield, with clear reasons |
| 10 | Public launch | Email-based account recovery, reminders by email, rate limits on all writes, data export and account deletion, installable app, monitoring |

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

**More kinds of account**
- Besides banks, credit cards and cash: **meal cards** (Pluxee, formerly Sodexo, and similar employer food cards) and **wallets** (prepaid and UPI wallets).
- A meal card is topped up by the employer each month. That top-up is recorded as income in a "Meal benefit" category, or it comes from the payslip entry in Phase 7. Spending from it is an ordinary expense (restaurants, groceries) paid from the card.
- The card can carry an optional note of what it can be spent on, and an optional expiry for unspent balances.

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
- Income gets simple categories too: salary, freelance, rental income, interest, meal benefit, cashback and rewards, refund, gift, other.

**Repeating entries**
- Salary on the 1st, rent on the 5th, monthly SIPs.
- A schedule: **daily**, weekly, monthly or yearly, on a given day (daily covers a daily gold SIP).
- Each entry is either added automatically or shown for one-tap confirmation, as the user chooses.

**Data model (new tables, amounts in paise)**
- `user_modules`
- New account types: `wallets` (kinds: meal card, prepaid wallet)
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
- **Cashback:**
  - Cashback credited to the card lowers its outstanding amount. Cashback credited to a bank account is a deposit into that account.
  - Either way it is recorded as income in the "Cashback and rewards" category.
  - It is reported per card and per year ("this card earned ₹4,820 in cashback in 2026").
- **Reward points:**
  - The points balance per card, points earned per statement, and points redeemed (for cashback, vouchers or air miles).
  - An optional rupee value per point gives the balance a worth, which is shown separately and is not counted in net worth.
  - Points nearing expiry trigger a reminder.
- **Card comparison:** effective cashback rate per card (cashback and redeemed rewards divided by spend), to show which card actually pays back the most.
- **Reminders and warnings:** due dates, minimum-only payments, and interest charged on a balance carried over.
- Existing cards move into credit lines of one card each.

Data: `credit_lines`, `card_statements`, `card_rewards` (points earned, redeemed, expiry), plus new columns on `credit_cards`.

## Phase 5: Investments

- **Holdings:**
  - **physical gold:** each piece of jewellery, coin or bar, with its weight in grams and purity (24, 22 or 18 carat). It is valued at the day's rate for that purity, so its value moves with the gold price.
    - The purchase price, date and making charges are kept. Making charges and wastage are part of the cost but not of the resale value, so the profit or loss shows that honestly.
    - Sales and exchanges for new jewellery are recorded too.
  - **digital gold:** grams held with a platform;
  - Sovereign Gold Bonds (units, issue price, interest rate, maturity);
  - stocks;
  - mutual funds (units, SIPs);
  - crypto.
- Buys and sells are movements. Average cost and realised and unrealised profit and loss are calculated.
- **SIPs for any holding,** daily, weekly or monthly. Examples: ₹100 of digital gold every day, or ₹5,000 into a mutual fund on the 5th.
  - Each SIP is a repeating entry (Phase 1) that records a buy.
  - The grams or units are worked out from that day's price, or entered from the platform's confirmation.
  - Each SIP shows its total invested, current value, average buying price, and the number of instalments made or missed.
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

## Phase 6: Property, rentals and physical assets

**Land and property**
- Each property: type (land, flat, house, commercial), location, area, purchase price and date, and costs such as stamp duty, registration and brokerage.
- **Current value:** entered by the user when they have an estimate (a valuation, a circle rate, a recent nearby sale). Between estimates it can grow at an assumed yearly rate the user sets. Every value shows its date and whether it is an estimate.
- A linked home loan (Phase 3) shows the equity: value minus what is still owed.
- Running costs (property tax, maintenance, repairs, society charges) are expenses tagged to the property.

**Rents**
- Tenants per property: residential or commercial, rent, due day, agreement start and end, and yearly increase.
- **Rent received is income** in the "Rental income" category, into the chosen account. Missed and late rents are flagged.
- A **security deposit** held from a tenant is money owed back, so it counts as a liability until it is returned.
- For each property: **rental yield**, meaning yearly rent less running costs as a percentage of its value, and the total earned over time.
- A reminder when an agreement is about to end or the yearly increase is due.

**Vehicles and other physical assets**
- Cars, bikes, and other things of lasting value (electronics, furniture, equipment): purchase price, date, and a **depreciation method**:
  - **reducing balance** at a yearly rate, with sensible defaults (for example about 15% a year for a car) that the user can change;
  - or **straight-line** over a number of years, down to a residual value.
- The value goes down each month on that schedule. The user can override it with a real quote, for example a resale offer.
- When the asset is sold, the sale price is recorded and the gain or loss shown. A linked vehicle loan (Phase 3) shows what is still owed against it.
- Running costs (fuel, servicing, vehicle insurance) are expenses tagged to the asset.

Data: `properties`, `property_valuations`, `tenants`, `tenancies`, `rent_payments`, `physical_assets`, `asset_valuations`.

## Phase 7: Savings, retirement and goals

**Deposits**
- **Recurring deposits:** monthly instalment, rate, start date, tenure. The maturity date and value are calculated, and instalments are tracked as paid or missed.
- **Fixed deposits:** amount, rate, compounding, maturity, and interest earned so far.
  - **Interest as income:**
    - with a **payout** FD (monthly or quarterly), each payout is "Interest" income into the chosen account;
    - with a **cumulative** FD, interest builds up inside the FD and shows as earned each year, and the full maturity amount goes to the bank on maturity;
    - tax deducted at source on the interest is recorded as tax paid.
  - Premature withdrawal records the reduced rate or penalty.
- A reminder before a deposit matures.

**Post office and government savings schemes**

Each scheme has its own rules built in, with the interest rate entered per period. The government revises these rates quarterly, so the user can record a new rate when it changes.

| Scheme | What is tracked |
|---|---|
| Public Provident Fund (PPF) | Yearly deposits within the allowed minimum and maximum, the 15-year term and extensions, interest credited yearly, when partial withdrawals and loans become allowed |
| Sukanya Samriddhi Yojana (SSY) | Deposits for a daughter's account, the deposit years and maturity, interest credited yearly |
| National Savings Certificate (NSC) | Purchase amount, interest compounded yearly and paid at maturity, the maturity value |
| Kisan Vikas Patra (KVP) | Purchase amount and the date the amount doubles |
| Post Office Monthly Income Scheme (MIS) | Deposit, monthly interest paid out to a bank account, maturity |
| Senior Citizens' Savings Scheme (SCSS) | Deposit, quarterly interest payouts, maturity and extension |
| Post office recurring and time deposits | As recurring and fixed deposits above, with post office terms |

- Interest is shown as earned, and once credited it is recorded as income in the "Interest" category.

**Retirement: EPF, VPF and NPS**
- **Employees' Provident Fund (EPF):**
  - the employee's and the employer's monthly contributions, and any Voluntary Provident Fund (VPF);
  - interest credited each year at the rate the user enters;
  - the running balance, which counts toward net worth;
  - withdrawals and advances.
- **National Pension System (NPS):**
  - Tier I and Tier II accounts;
  - the user's own contributions and the **employer's contributions**, kept apart because they count under different tax sections;
  - units and NAV per scheme (equity, corporate bonds, government securities), with daily NAVs as a later live-price source;
  - the current value and how it is split.
- Both are assets in net worth, marked as locked until retirement.

**Payslip entry**
- One entry for a month's salary that splits into its parts:
  - net pay to a bank account;
  - EPF and VPF contributions, to the EPF account;
  - the employer's NPS contribution, to the NPS account;
  - the meal card top-up, to the meal card;
  - tax deducted at source and professional tax, recorded as taxes paid.
- Gross salary is the income. Each part goes to its account in the same transaction, so the totals always add up.
- It can be a repeating entry, so a typical month is one confirmation.

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

Data: `deposits` (including post office deposits), `deposit_instalments`, `schemes` and `scheme_rates` (PPF, SSY, NSC, KVP, MIS, SCSS), `retirement_accounts` (EPF, VPF, NPS) and `retirement_contributions`, `payslips` and `payslip_lines`, `pots`, `goals`, `goal_sources`.

## Phase 8: Net worth, insurance and tax

- **Net worth** = everything owned minus everything owed:
  - owned: banks, cash, meal cards and wallets, deposits, post office schemes, EPF, VPF and NPS, investments (including physical gold at the day's rate), land and property at their latest value, vehicles and other assets at their depreciated value, and money others owe the user;
  - owed: loans, card dues, security deposits held from tenants, and money the user owes others.
- Net worth can also be shown **excluding the home the user lives in and locked retirement savings**, to show what is actually available.
- A month-end snapshot builds a **trend chart**.
- **Health ratios:**
  - EMI-to-income;
  - debt-to-assets;
  - savings rate;
  - emergency fund coverage, in months of average spending.
- **Insurance:**
  - **Term life insurance:** insurer, policy number, sum assured, premium and how often it is paid, policy term, nominee, and riders.
  - **Health insurance:**
    - individual or family floater, and who is covered;
    - sum insured, plus top-up or super top-up cover and its deductible;
    - premium, renewal date, and no-claim bonus;
    - a claims log with amounts claimed and settled;
    - whether the employer's group cover is included.
  - **Other policies:** vehicle, home and endowment, with the same basic fields.
  - Premiums are expenses in the "Insurance" category. Every policy has a renewal reminder, and term and health covers show whether the cover looks adequate against simple rules of thumb (information only).
- **Tax-saving tracker (India), information only:**
  - **Section 80C:** EPF and VPF employee contributions, PPF, ELSS, NSC, SSY, life insurance premiums, home loan principal, tuition fees.
  - **Section 80CCD(1B):** the user's own extra NPS contributions.
  - **Section 80CCD(2):** the employer's NPS contribution.
  - **Section 80D:** health insurance premiums, for self and family and for parents.
  - Contributions recorded anywhere in FinDB count toward the limits automatically.
  - It asks which tax regime the user follows and shows only the sections that apply to it. Limits and rules are stored per financial year and updated when the budget changes them, never hard-coded.

Data: `net_worth_snapshots`, `insurance_policies`, `insurance_members`, `insurance_claims`, `tax_profile`, `tax_rules` (per financial year).

## Phase 9: Financial status review

Once the user has entered some assets and liabilities, FinDB reviews whether their finances are **heading the right way or the wrong way**, compared with inflation and the market. Each area gets a status (on track, needs attention, or off track), the numbers behind it, and a plain-language reason.

| Area | What is compared |
|---|---|
| Returns against inflation | Each asset's yearly return (FDs, savings accounts, PPF, EPF, mutual funds, stocks, gold, property) against consumer price inflation, giving the **real return**. For example, an FD earning 7% when inflation is 5% is +2% a year in real terms; a savings account at 3% is losing value. |
| Returns against the market | Mutual funds and stocks against a benchmark index (for example the Nifty 50), gold against the gold price, and property against the user's own growth assumption |
| Net worth | Growth over 1, 3 and 5 years, before and after inflation |
| Allocation | How wealth is spread (cash, deposits, equity, gold, property, retirement), compared with a target the user sets or a simple age-based guide. It flags concentration, such as most wealth in one illiquid property. |
| Liquidity | Money available quickly against months of spending (the emergency fund) |
| Debt | EMI-to-income, high-cost debt present, loans on assets that lose value (a car loan larger than the car's value) |
| Protection | Term cover as a multiple of yearly income, and health cover against family size |
| Rental property | Rental yield against what the same money would earn in an FD, after costs |
| Depreciating assets | How much of total wealth sits in things that lose value |
| Savings | The savings rate over time, and whether goals are on track |

- **Market and inflation data:** consumer price inflation (published monthly), benchmark index values, gold rates, and current FD and small-savings rates. These are stored in a table with their dates and sources, updated by a scheduled job where a source with suitable terms exists, and editable otherwise.
- A **review page** with the overall picture and each area's status. It is refreshed each month, and its history shows whether things are improving.
- Every review is clearly marked as rule-based information, not personal financial advice. Thresholds, such as what counts as a healthy EMI-to-income ratio, are shown alongside each result and can be adjusted.

Data: `market_data` (inflation, benchmarks, rates, with dates and sources), `status_reviews` (monthly results per area), `allocation_targets`.

## Phase 10: Public launch

- **Account recovery by an emailed link,** replacing the security question. Registration stops revealing whether an email is in use. Both need an email provider.
- **Reminders by email** as well as in the app: EMIs, card due dates, reward points expiring, deposit and scheme maturities, the yearly PPF deposit, insurance renewals, rent due and tenancy renewals, overdue money from people.
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
| Phase 7 | Which schemes ship first (suggested: PPF, EPF, NPS, then the post office schemes), and where scheme interest rates come from (entered by the user, or a maintained table updated each quarter) |
| Phase 6 | Default depreciation rates per asset type, and whether property values grow on an assumed rate between the user's own estimates |
| Phase 8 | How the tax rules per financial year are kept up to date |
| Phase 9 | Sources for inflation, benchmark and rate data, and the default thresholds for each status |
| Phase 10 | The email provider |
