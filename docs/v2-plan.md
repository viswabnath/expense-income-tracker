# FinDB v2 plan

_Drafted 2026-10-03. Status: **proposed, awaiting approval.** Nothing in this plan is built yet. Each phase starts only after it is approved, and each phase ends with a full test run and a reviewed pull request._

v2 turns FinDB from an income-and-expense tracker into a full personal finance dashboard for India. The user records their own money, imports bank and card statements to save typing, and sees everything in one place:
- accounts and spending;
- loans, including gold loans and money lent to or borrowed from people;
- credit cards with cashback and rewards;
- investments with live prices;
- property and rents;
- vehicles and other assets;
- deposits, post office schemes and retirement savings;
- insurance, taxes and goals;
- net worth;
- a review of whether their finances are heading the right way compared with inflation and the market.

FinDB never moves money and never connects to a bank on its own. Outside connections are optional and chosen by the user: price feeds, a broker account, and later a consent-based bank data connection.

This plan combines the original v2 brief (see `docs/v2-audit.md`) with everything agreed on 2026-10-03.

## Rules for every phase

**Money and data**
- **A double-entry ledger.** Every money event is one journal entry made of lines. Each line moves an amount into or out of an account, and the lines of an entry always add up to zero. Banks, cash, cards, wallets, loans, money owed by or to people, investments, deposits, property and vehicles are all accounts, and so are income and expense categories. Balances come from the ledger, so they cannot drift apart from the entries. The database enforces that every entry balances, and tests check it for every kind of event.
- **Exact money.** Amounts are stored as `bigint` paise (₹12.50 is `1250`), never in floating point. Every amount carries a currency; it is INR until multi-currency arrives in Phase 12.
- **Corrections keep history.** Editing or deleting an entry records what changed, and statements already reconciled stay explainable.
- **Atomic writes.** Each event, with every line, balance change and activity log entry it causes, is saved in one transaction (`withTransaction`). Rows that are checked or changed are locked.
- **Per-user isolation enforced by the database.** Each request runs in a transaction that sets `app.user_id`. Row level security policies on every user table allow only rows where `user_id = current_setting('app.user_id')::int` (the decision recorded on 2026-09-30). Queries also keep their own `user_id` filters.
- **Only the user's own accounts.** Every entry checks that the accounts it uses belong to the user.
- **Every change is logged** in the activity log, in the same transaction.

**Security and privacy**
- **Sensitive values are encrypted** before they reach the database: PAN, bank account numbers, policy numbers, folio numbers, and uploaded documents. They are shown masked by default.
- **India's Digital Personal Data Protection Act, 2023:**
  - a clear notice and consent at sign-up;
  - the user can see, correct, export and erase their data;
  - data is kept only as long as needed;
  - there is a written plan for handling a breach.
- **Backups:** daily database backups, and a restore that has actually been tested.
- **Information, not advice.** Insights, rankings, simulations and reviews are rule-based calculations and general explanations, never personal investment advice; in India that advice is regulated by SEBI. Every such screen says so and shows the thresholds it used.

**Process**
- **Migrations:** each phase ships its database changes as numbered SQL files for the owner to apply (the decision recorded on 2026-09-30). Tests run them on the `balancetrack_test` schema first.
- **No emoji anywhere**; names and messages are rendered as text.
- **Tests per phase:**
  - unit tests for every calculation;
  - API tests over HTTP for every route, including isolation between users;
  - ledger balance checks;
  - Playwright flows for the main screens;
  - one full run at the end of the phase.

## Overview

| Phase | Name | What the user gets |
|---|---|---|
| 1 | Foundation | Double-entry ledger with opening balances and reconciliation; new design; meal cards and wallets; module switches; transfers and other movements; categories and tags; repeating entries; two-factor login, session management, encryption, privacy, backups, database-enforced isolation |
| 2 | Import, insights and budgets | Bank and card statement import, quick and bulk entry, category averages, subscription finder, trips, budgets, unusual-spend flags |
| 3 | Debts and people | Loans with EMIs; gold loans and loans against FDs, insurance, securities and property; chit funds; money lent and borrowed with people; split costs; dangerous-debt ranking and payoff plans |
| 4 | Credit cards | Shared credit lines, statements, loans on cards, cashback and reward points |
| 5 | Public launch | Email verification and recovery, reminders by email, rate limits on every write, data export and account deletion, installable app, monitoring |
| 6 | Investments | Physical and digital gold, Sovereign Gold Bonds, stocks, mutual funds, ETFs, bonds, REITs and InvITs, crypto, ESOPs and RSUs; SIPs; dividends; profit and loss; live prices |
| 7 | Property, rentals and physical assets | Land and property with values and ownership shares, tenants and rent, vehicles and other assets with depreciation |
| 8 | Savings, retirement and goals | RDs and FDs with interest, post office schemes, EPF, VPF and NPS, the payslip entry, savings pots, goals |
| 9 | Net worth, insurance and tax | Net worth and its trend, health ratios, term and health insurance, tax tracker with capital gains, rent paid and advance tax |
| 10 | Financial status review | Whether each area is heading the right way against inflation and the market, with reasons |
| 11 | Household, estate and documents | Family sharing and joint ownership, nominees, an estate summary, a document vault |
| 12 | Multi-currency and global investments | Accounts in other currencies, US stocks bought from India, exchange rates |
| 13 | Business and freelance income | A simple business book, invoices, GST collected and paid |
| 14 | Account Aggregator | Consent-based bank and investment data through RBI's Account Aggregator framework |

**Why this order**
- **Phase 1 lays the ledger.** Every later feature records money through it, so it must exist first.
- **Import arrives in Phase 2.** Manual typing is the main reason people stop using a finance app.
- **Public launch moves up to Phase 5,** so real users get a safe, complete core (accounts, spending, debts, cards) while the wider features arrive phase by phase.
- **Phases 12 to 14 are later work.** Each needs outside dependencies or partners.

---

## Phase 1: Foundation

Phase 1 is several pull requests: the ledger and migration, then security and privacy, then the design system, then the remaining features.

**Double-entry ledger**
- **Tables:**
  - `ledger_accounts`, with a kind (asset, liability, income, expense, equity), a subtype (bank, cash, card, wallet, meal card, and later loan, holding, deposit, property and so on) and a currency;
  - `journal_entries`: date, description, type, and links to the feature that made the entry;
  - `journal_lines`: account, amount in paise, and sign.
- **Database checks:** every entry's lines must sum to zero, and lines may only use the user's own accounts.
- **Balances:** each account's balance is the sum of its lines. Fast balances are kept in a summary table updated in the same transaction, and a check compares it with the lines.
- **Opening balances:** starting with money the user already had is an entry against an "opening balance" equity account, so the starting point is clear and changes nothing else.
- **Reconciliation:** the user enters the balance from a statement on a date, marks entries as cleared, and sees the difference and which entries make it up.
- **Corrections:** an edit or deletion keeps the original in history. Reconciled periods show a warning before they change.
- **Migrating today's data:** existing banks, cards, cash, income and expenses become ledger accounts and entries. Each balance is checked against the old tables before the switch, and the old tables stay read-only until the move is verified.

**More kinds of account**
- Banks, cash and credit cards as today, plus **meal cards** (Pluxee, formerly Sodexo, and similar employer food cards) and **wallets** (prepaid and UPI wallets).
- A meal card is topped up by the employer each month. The top-up is "Meal benefit" income, or comes from the payslip entry in Phase 8. Spending from it is an ordinary expense paid from the card. The card can also note where it may be used, and when unspent money expires.

**Money movements that are not income or expenses**
- These are ledger entries between asset and liability accounts:
  - transfers between own accounts;
  - loan payouts and principal repayments;
  - investment buys and sells;
  - deposits in and out;
  - money lent to or repaid by people.
- They change balances but never count as income or spending.
- **Net savings = income - expenses**, where expenses include loan interest and fees but not principal. The monthly summary is rebuilt on this rule, which also fixes the known issue about accounts created on the last day of a month.

**Expense categories and tags**
- **Default expense categories:** Rent, Groceries, Restaurants and food delivery, Fuel, Transport, Subscriptions, Movies and entertainment, Shopping, Health, Education, Travel, Bills and utilities, Insurance, Loan interest and fees, Taxes, Gifts, Personal care, Other. Users can rename them and add their own.
- **Income categories:** salary, freelance, rental income, interest, dividends, meal benefit, cashback and rewards, refund, gift, other.
- **Suggested category from the title:** a keyword list ("Swiggy" means restaurants, "HP Petrol" means fuel) that learns from the user's own choices.
- **Tags** for things that cut across categories, such as "Goa trip 2026".
- Existing expenses start as "Uncategorised" and can be categorised in bulk.

**Repeating entries**
- Daily, weekly, monthly or yearly, on a chosen day: salary, rent, SIPs, a daily gold SIP.
- Each is either added automatically or shown for one-tap confirmation.

**Module switches**
- Income, Expenses, Investments, Debts, Cards, Property, Retirement and Insurance can each be turned on or off in Settings. This replaces the sign-up choice (`tracking_option`); existing users are mapped from it.
- Turned-off modules disappear from the screens. Their data stays, and switching a module back on shows it again.

**Security and privacy**
- **Two-factor login is mandatory** (decided 2026-10-03), using time-based codes (TOTP) from any authenticator app, such as Google Authenticator or Microsoft Authenticator. It is free: no SMS, no paid service. One-time recovery codes are given at setup. New users set it up at sign-up; existing users at their next login.
- **Sign in with Google** (Google's free OAuth) can be added later as an extra way to log in. Two-factor login still applies to password logins.
- **Sessions:** a list of active sessions (device, browser, last seen), with "sign out" for each and "sign out everywhere". Login history.
- **Passwords:** allow long passphrases (well beyond today's 16-character limit), and refuse common and known-breached passwords.
- **Encryption** of sensitive fields, as described in the rules: AES-256-GCM in the application, with the key in an environment secret (decided 2026-10-03: free, and Vercel encrypts environment variables at rest). Each value records its key version, so the key can be rotated without downtime. Values are shown masked.
- **Privacy:** the sign-up notice and consent, and the data inventory that export and erasure (Phase 5) are built on.
- **Backups:** daily backups confirmed, and a restore rehearsed and documented.

**Design system**
- Source Sans 3 with tabular numerals, so amounts line up.
- Light and dark themes built from tokens.
- Borders instead of shadows; no blurred panels and no gradients.
- A chart library, bundled from npm.
- Shared components. Every existing screen moves to the new design.

**Done when**
- every existing balance matches after the move to the ledger, and every entry balances;
- reconciliation finds a planted difference;
- two-factor login and "sign out everywhere" work;
- sensitive fields are encrypted in the database;
- a backup has been restored;
- the new design is on every screen in both themes;
- a transfer does not change income or expenses;
- categories are suggested;
- repeating entries fire;
- a test proves one user cannot read another user's rows even with the query's `user_id` filter removed.

## Phase 2: Import, insights and budgets

**Statement import**
- **Upload a bank or card statement** as CSV or Excel. Columns are mapped once per bank, and the mapping is remembered. Presets cover the major Indian banks and card issuers.
- **PDF statements next,** including password-protected ones; the user types the password, and it is never stored.
- **A review screen before anything is saved:**
  - duplicates are flagged (same date, amount and description, or already entered by hand);
  - categories are suggested;
  - transfers between the user's own accounts are detected and paired.
- Statement files are processed and discarded, not stored, unless the user chooses to keep them in the document vault (Phase 11).
- Imported balances feed reconciliation.

**Faster entry:** quick-add with just an amount, account and category; a spreadsheet-style grid for many entries at once.

**Spending insights**
- **Category averages:** "Restaurants: ₹6,800 a month on average over 3, 6 or 12 months, up 22%."
- **Subscription finder:** repeating similar charges are flagged as subscriptions, with the monthly and yearly total, new ones, price increases, and ones that stopped.
- **Trips and events:** a tag's total by category.
- **Top categories and month-on-month changes,** as charts.
- **Budgets:** a monthly limit per category, with alerts at 80% and 100%.
- **Unusual-spend flags:** "Fuel this month is twice your average."

Data: `import_profiles`, `import_batches`, `budgets`.

## Phase 3: Debts and people

**Loans from banks and lenders**
- Reducing-balance and flat-rate loans, with the effective yearly rate shown.
- A full repayment schedule.
- EMIs recorded as full, partial or late, and missed EMIs flagged.
- Prepayments and top-ups, with the interest saved shown.
- An EMI splits automatically into principal (a movement) and interest (an expense in "Loan interest and fees").
- **A public EMI calculator.**

**Loans backed by an asset**
- **Gold loans:**
  - the gold pledged (weight and purity), the loan-to-value, interest, and bullet or EMI repayment;
  - the gold is marked as pledged until the loan is closed;
  - a warning if the gold price falls enough to risk a margin call.
- **Loans against an FD, an insurance policy, securities or property:** the asset is linked and shown as pledged, and the loan reduces what is available from it.

**Chit funds**
- The chit value, members, monthly contribution, and the auction or draw schedule.
- Before the user wins the chit, each monthly payment is savings, and any dividend (their share of the auction discount) is income.
- Once they win, the prize received and the remaining contributions behave like a loan.
- FinDB works out the effective return or cost, so a chit can be compared with an RD or a personal loan.

**Money with people**
- Money lent and borrowed: interest-free or with interest, an optional due date, repayments in parts, and a status of open, overdue or settled.
- Lending and repayments are movements, not income or spending. Money owed to the user counts as an asset; money they owe counts as a liability.
- **Split costs:** the user's share is the expense, and the others' shares become money owed to the user.

**Which debt is most dangerous**
- Debts ranked by their true yearly cost, with a plain-language explanation of each type: credit card balance carried over, buy-now-pay-later and instant loan apps, personal and card loans, gold loans, vehicle loans, home loans.
- **Payoff simulator:** highest-rate-first against smallest-balance-first, showing interest saved and the debt-free date.
- **Warnings:** minimum-only payments, a high EMI-to-income ratio, gold loan margin risk, and overdue money from people.

Data: `loans`, `loan_payments`, `pledges`, `chit_funds`, `chit_instalments`, `people`, `person_loans`, `person_loan_payments`, `splits`.

## Phase 4: Credit cards

- **Credit lines:** one shared limit across several cards.
- **Statements:** billing and due days, the amount due, the minimum due, and payments matched to statements.
- **Loans on a card,** using the Phase 3 loan engine.
- **Cashback:** cashback credited to the card or to a bank is income in "Cashback and rewards", reported per card and per year.
- **Reward points:** the balance, points earned and redeemed, an optional value per point (shown but not counted in net worth), and reminders before points expire.
- **Card comparison:** the effective cashback rate per card.
- **Warnings:** due dates, minimum-only payments, and interest charged on a balance carried over.

Data: `credit_lines`, `card_statements`, `card_rewards`.

## Phase 5: Public launch

The core (ledger, accounts, spending, import, debts and cards) is complete, so FinDB opens to the public here. The remaining phases arrive as updates.

- **An email provider**, and with it:
  - **email verification at sign-up,** after which registration stops revealing whether an email is already in use;
  - **account recovery by an emailed link,** replacing the security question;
  - **reminders by email** as well as in the app. Reminder types grow with each phase: EMIs, card due dates, points expiring, maturities, PPF deposits, insurance renewals, rent, and money owed by people.
- **Rate limits on every write,** with a shared store so the limits hold across server instances.
- **Data export** (everything, as CSV or JSON) and **account deletion**, completing the data protection rights.
- **Installable app (PWA).**
- **Error monitoring** and uptime alerts.
- Updated privacy policy and terms, and a final review of the wording on every "information, not advice" screen.

## Phase 6: Investments

**What can be held**
- **Physical gold:** each piece of jewellery, coin or bar, with its weight and purity (24, 22 or 18 carat), valued at the day's rate for that purity. Making charges and wastage are part of the cost but not the resale value. Sales and exchanges for new jewellery are recorded.
- **Digital gold**, **gold ETFs**, and **Sovereign Gold Bonds** (units, issue price, interest, maturity).
- **Stocks**, **mutual funds** (including SIPs and the income distribution option, IDCW) and **ETFs**.
- **Bonds:** government securities, corporate and tax-free bonds. Coupon interest is income, and maturity is tracked.
- **REITs and InvITs:** units and distributions.
- **Crypto.**
- **ESOPs and RSUs:** grants, vesting schedules, and exercise or vesting at fair market value.
  - The value at vesting or exercise is income from salary, taxed as a perquisite.
  - Shares sold to cover tax are recorded.
  - From then on the shares are ordinary holdings, and their cost is the value they were taxed at.

**How holdings are tracked**
- Buys and sells are ledger movements. Each purchase is kept as its own lot, so profit and loss and capital gains (Phase 9) use the right purchase date and cost.
- **Dividends, interest and distributions are income.** A dividend reinvested in the same fund is recorded as a buy.
- **SIPs, daily, weekly or monthly,** for any holding. Each SIP shows the total invested, current value, average price, and instalments made or missed.
- **Allocation chart.** Profit and loss, both realised and unrealised.

**Prices**
- Prices can always be entered by hand, and every price shows its date and source.
- **Live prices (optional):** a scheduled server job fetches prices once a day; the browser never calls price services itself.

  | Asset | Planned source | Note |
  |---|---|---|
  | Mutual funds | AMFI's daily NAVs | Official and free |
  | Crypto | CoinGecko public API | Free tier, rate limits, attribution |
  | Gold, gold ETFs, Sovereign Gold Bonds | A published daily gold rate or a paid metals feed | Check the terms before automating |
  | Stocks, ETFs, REITs, InvITs, bonds | A paid data provider, or the user's own broker API (for example Upstox or Zerodha Kite Connect) with their permission | Exchange data needs a licence; no scraping |

- The first release covers mutual funds and crypto; gold and exchange-traded prices follow.

Data: `holdings`, `holding_lots`, `investment_transactions`, `grants` and `vesting_events` (ESOPs and RSUs), `prices`, `price_sources`.

## Phase 7: Property, rentals and physical assets

**Land and property**
- Type (land, flat, house, commercial), location, area, purchase price and date, and costs such as stamp duty, registration and brokerage.
- **Ownership share:** for example 50% owned with a spouse. Net worth counts only the user's share.
- **Current value:**
  - the user's own estimates (a valuation, a circle rate, a recent nearby sale), each with its date and marked as an estimate;
  - optional growth at an assumed rate between estimates.
- **Equity:** a linked home loan shows value minus what is still owed.
- Running costs (property tax, maintenance, repairs, society charges) are expenses tagged to the property.

**Rents**
- Tenants per property: residential or commercial, rent, due day, agreement dates, yearly increase.
- **Rent received is "Rental income."** Late and missed rents are flagged.
- **Security deposits** held are liabilities until returned.
- **Rental yield** for each property, and reminders before agreements end or rent increases.
- Tax deducted by a commercial tenant is recorded as tax paid.

**Vehicles and other physical assets**
- Cars, bikes, electronics, furniture and equipment, each with a purchase price, a date and an ownership share.
- **Depreciation:** reducing balance at a yearly rate (about 15% a year for a car by default, changeable), or straight-line down to a residual value. The value falls monthly, and a real resale quote can override it.
- **On sale:** the gain or loss. A linked vehicle loan shows what is still owed.
- Running costs (fuel, servicing, vehicle insurance) are expenses tagged to the asset.

Data: `properties`, `property_valuations`, `ownership_shares`, `tenants`, `tenancies`, `rent_payments`, `physical_assets`, `asset_valuations`.

## Phase 8: Savings, retirement and goals

**Deposits**
- **Recurring deposits:** the maturity date and value are calculated, and instalments are tracked.
- **Fixed deposits:**
  - **payout** FDs pay interest to a bank account as "Interest" income;
  - **cumulative** FDs build interest inside the FD, shown as earned each year;
  - tax deducted at source is recorded, and premature withdrawals record the reduced rate or penalty.
- A reminder before each maturity.

**Post office and government savings schemes**

The scheme rules are built in. The interest rate is recorded per period, because the government revises these rates quarterly.

| Scheme | What is tracked |
|---|---|
| Public Provident Fund (PPF) | Yearly deposits within the limits, the 15-year term and extensions, yearly interest, when withdrawals and loans become allowed |
| Sukanya Samriddhi Yojana (SSY) | Deposits for a daughter's account, deposit years, maturity, yearly interest |
| National Savings Certificate (NSC) | Interest compounded yearly and paid at maturity |
| Kisan Vikas Patra (KVP) | The date the amount doubles |
| Post Office Monthly Income Scheme (MIS) | Monthly interest paid out |
| Senior Citizens' Savings Scheme (SCSS) | Quarterly interest payouts, maturity, extension |
| Post office recurring and time deposits | As RDs and FDs, with post office terms |

**Retirement**
- **EPF and VPF:** employee and employer contributions, yearly interest, withdrawals and advances.
- **NPS:** Tier I and II; the user's own and the employer's contributions kept apart; units and NAV per scheme.
- Both are assets marked as locked until retirement.

**Payslip entry**
- One month's salary split into: net pay to a bank; EPF and VPF; the employer's NPS contribution; the meal card top-up; tax deducted at source and professional tax as taxes paid.
- Gross salary is the income, and the parts are lines of one ledger entry, so it always balances.
- It can repeat, so a typical month is one confirmation.

**Savings pots:** money set aside inside an account for a purpose.

**Goals**
- Short-term and long-term goals (a dream bike, an emergency fund, a house down payment, clearing a loan), funded by any mix of deposits, pots, investments and monthly contributions.
- Each goal shows progress, the monthly amount still needed, whether it's on track, behind or ahead, and what-ifs.

Data: `deposits`, `deposit_instalments`, `schemes`, `scheme_rates`, `retirement_accounts`, `retirement_contributions`, `payslips`, `payslip_lines`, `pots`, `goals`, `goal_sources`.

## Phase 9: Net worth, insurance and tax

**Net worth**
- Everything owned minus everything owed, at each item's latest value: physical gold at the day's rate, property and joint assets at the user's share, vehicles at their depreciated value, pledged assets marked as pledged.
- Also shown **without the user's own home and locked retirement savings.**
- A monthly snapshot builds a trend chart.
- **Health ratios:** EMI-to-income, debt-to-assets, savings rate, emergency fund coverage.

**Insurance**
- **Term life:** sum assured, premium, term, nominee, riders.
- **Health:** floater and members, sum insured, top-ups and their deductible, renewal, no-claim bonus, claims log, employer cover.
- **Other policies:** vehicle, home, endowment.
- Premiums are expenses. Every policy gets renewal reminders and an adequacy check against rules of thumb (information only).

**Tax tracker (India), information only**
- **Deductions:**
  - 80C: EPF and VPF, PPF, ELSS, NSC, SSY, life premiums, home loan principal, tuition fees;
  - 80CCD(1B): the user's own NPS;
  - 80CCD(2): the employer's NPS;
  - 80D: health premiums;
  - home loan interest.
- **Capital gains:** short-term and long-term gains on shares, equity funds, debt funds, gold, property and other assets.
  - Holding periods and rates are applied per financial year from the purchase lots.
  - Each year's realised gains are summarised.
- **Rent paid,** for house rent allowance (with the landlord's PAN, stored encrypted, when the rules need it).
- **Advance tax:** an estimate of tax due on income other than salary (interest, rent, capital gains, freelance), with reminders for the quarterly due dates.
- **Taxes paid:** tax deducted at source from every source, compared with the totals the user enters from their Annual Information Statement (AIS) or Form 26AS.
- It asks which regime the user follows and shows only what applies. Rules, limits and rates are stored per financial year and updated when the budget changes them, never hard-coded.

Data: `net_worth_snapshots`, `insurance_policies`, `insurance_members`, `insurance_claims`, `tax_profile`, `tax_rules`, `capital_gains` (computed per year), `rent_paid`.

## Phase 10: Financial status review

Once some assets and liabilities are entered, FinDB reviews whether each area is **heading the right way or the wrong way** compared with inflation and the market. Each area gets a status (on track, needs attention, or off track), the numbers behind it, and a plain reason.

| Area | What is compared |
|---|---|
| Returns against inflation | Each asset's yearly return against consumer price inflation, giving the real return (for example, an FD at 7% with inflation at 5% is +2% a year in real terms) |
| Returns against the market | Funds and stocks against a benchmark such as the Nifty 50, gold against the gold price, property against the user's assumption |
| Net worth | Growth over 1, 3 and 5 years, before and after inflation |
| Allocation | Spread across cash, deposits, equity, gold, property and retirement, against a target or an age-based guide. It flags concentration and illiquidity. |
| Liquidity | Money available quickly, in months of spending |
| Debt | EMI-to-income, costly debt, loans larger than the asset behind them, gold loan margin risk |
| Protection | Term cover as a multiple of income, and health cover against family size |
| Rental property | Yield after costs, against an FD |
| Depreciating assets | The share of wealth in things that lose value |
| Savings | The savings rate over time, and whether goals are on track |

- **Market and inflation data** (inflation, benchmark indices, gold, FD and small-savings rates) is stored with dates and sources. It is updated by a scheduled job where a source's terms allow, and editable otherwise.
- **A review page,** refreshed monthly, with a history that shows whether things are improving.
- Every result shows its threshold, which can be adjusted, and is marked as rule-based information, not advice.

Data: `market_data`, `status_reviews`, `allocation_targets`.

## Phase 11: Household, estate and documents

**Household**
- Invite a spouse or family member to see a shared household view (read-only or full), while each person keeps their own private accounts.
- Joint accounts and assets carry each member's share, and the household totals count everything exactly once.

**Nominees and estate summary**
- A nominee for each bank account, deposit, policy, investment, retirement account and property, with gaps flagged ("3 accounts have no nominee").
- An **estate summary:** everything held and owed, where it is, account and policy references (masked unless unlocked), nominees, and contacts.
  - It can be exported as a PDF for the family, protected with two-factor confirmation.
- Optional **trusted contact access:** a named person can request access, which is granted only after a waiting period during which the user can refuse. This needs careful design and a security review before it ships.

**Document vault**
- Upload policy documents, property papers, warranties, statements and receipts, linked to the asset they belong to.
- Files are encrypted, private storage only, with size and type limits.
- Expiry dates (warranties, policies) feed reminders.

Data: `households`, `household_members`, `nominees`, `documents`, `access_requests`.

## Phase 12: Multi-currency and global investments

- **Accounts and assets in other currencies,** valued in INR at daily exchange rates, with the original currency kept.
- **US stocks bought from India** under the Liberalised Remittance Scheme:
  - remittances, including the tax collected at source on them;
  - holdings, dividends, and tax withheld abroad;
  - gains in INR.
- Information for the foreign assets schedule (Schedule FA) in the tax return.
- Exchange rates fetched daily, with their dates and sources.

Data: `currencies`, `exchange_rates`, plus currency on every account (present since Phase 1).

## Phase 13: Business and freelance income

- **A separate business book** for freelancers and small businesses:
  - income, expenses and simple invoices;
  - clients who owe money.
- **GST:** GST collected on invoices and paid on purchases, the net payable, and filing due dates.
- **Presumptive taxation** (for example section 44ADA for professionals), as information.
- Business profit flows into personal income and the tax tracker.

Data: `business_books`, `invoices`, `invoice_lines`, `gst_entries`.

## Phase 14: Account Aggregator

- **RBI's Account Aggregator framework:** the regulated, consent-based way for users to share data from their banks, mutual funds, insurers and pension accounts.
- FinDB would become a Financial Information User through a licensed partner. That needs business registration and a compliance review before any build.
- With the user's consent (renewable and revocable at any time), FinDB fetches statements and holdings and imports them through the Phase 2 review screen. Nothing is saved without the user confirming.

---

## Infrastructure, hosting and costs

_Prices are as known on 2026-10-03; check the current pricing pages before buying._

**Principles**
- **Managed services until they stop being cheap.** Vercel runs the app and Supabase runs Postgres, so there are no servers to patch, back up or scale by hand. FinDB uses plain SQL through `pg` and standard Next.js, so it can move to self-hosting later without a rewrite.
- **No nginx while on Vercel.** Vercel already does what nginx would: HTTPS, CDN caching, load balancing, and automatic scaling of the app per request. nginx becomes useful only if FinDB moves to its own servers (see Stage 4).
- **Pay only when users arrive.** Every stage below is triggered by real numbers, not guesses.

**Stage 1: building (now, no real users)**

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby | Free |
| Supabase, production | Free | Free |
| Supabase, tests and previews (new, separate project) | Free | Free |

- **A separate free Supabase project for tests and previews** ends the test-run stalls on the production database. It also replaces the `balancetrack_test` schema with a whole database that cannot reach production data.
- Free Supabase projects pause after a week without activity, have no automatic backups, and allow a 500 MB database. That is fine while building, not for real users. Until Stage 2, a scheduled `pg_dump` (a GitHub Actions job, free) keeps a daily backup of production in private storage.

**Stage 2: public launch (Phase 5)**

| Service | Plan | Approximate cost per month |
|---|---|---|
| Vercel | **Pro** (required: Hobby is for non-commercial use only, and FinDB is a product with a trademark) | about $20 |
| Supabase, production | **Pro**: no pausing, daily backups, 8 GB database, a small dedicated compute instance | about $25 |
| Email (verification, recovery, reminders) | A provider's free tier, for example Resend or Brevo, then paid as volume grows | Free at first |
| Rate-limit store | Upstash Redis free tier, through the Vercel Marketplace | Free at first |
| Error monitoring | Sentry free tier | Free at first |
| **Total** | | **about $45 (roughly ₹3,800)** |

- **Move production to Supabase's Mumbai region, and Vercel functions to `bom1` (Mumbai), before launch.** Users are in India: requests get faster, and data stays in India. Today the database is in Sydney. Moving means a new project and a data copy, which is easiest before there are real users.

**Stage 3: growth (thousands of users)**
- Upgrade the Supabase compute size as connections and query time grow. Add a read replica for heavy reports (the status review, insights) if needed.
- Use Supabase's point-in-time recovery add-on once the data is valuable enough to need restores to the minute.
- Vercel scales the app automatically and bills by use. Watch function time and set spend alerts.
- Move email to a paid plan when reminders exceed the free quota.
- Expected range: roughly $60 to $250 a month, depending on users and usage.

**Stage 4: large scale, only if managed costs become high**
- Run the app as a standalone Next.js build in containers on cloud servers (for example AWS, DigitalOcean or Hetzner), behind **nginx** or a cloud load balancer for HTTPS, caching and spreading traffic across several app instances. Keep Postgres managed: Supabase, or another provider such as AWS RDS or Neon.
- This is cheaper per unit of computing, but adds operational work: security updates, monitoring, scaling, and on-call.
- Consider it only when the managed bill is consistently above roughly $500 a month, or when a specific need appears.

---

## Decisions needed before or during the phases

| When | Decision |
|---|---|
| Before Phase 1 | **Decided 2026-10-03:** the default categories as listed in Phase 1. Module mapping from `tracking_option`: "income" turns on Income; "expenses" turns on Expenses and Cards; "both" turns on Income, Expenses and Cards. Other modules start off, and users turn them on. |
| Before Phase 1 | **Decided 2026-10-03:** tests and previews move to a separate free Supabase project (see Infrastructure), so test load never touches the production database |
| Phase 1 | **Decided 2026-10-03:** the key lives in an environment secret, with versioning for rotation; two-factor login is mandatory, with any authenticator app |
| Phase 1 | **Decided 2026-10-03:** repeating entries default to confirm-first (one tap); users can switch any of them to automatic |
| Phase 2 | **Decided 2026-10-03:** HDFC, ICICI, SBI, Axis and Kotak first (accounts and cards), then others on request |
| Phase 5 | The email provider |
| Phase 6 | Price sources and any paid plans, and whether to offer broker connections |
| Phase 7 | Default depreciation rates, and growth between property estimates |
| Phase 8 | Which schemes ship first, and where scheme rates come from |
| Phase 9 | How tax rules per financial year are kept up to date, and whether capital gains are calculated or only summarised |
| Phase 10 | Sources for inflation, benchmark and rate data, and the default thresholds |
| Phase 11 | Where documents are stored (private Vercel Blob or Supabase Storage), and whether trusted contact access is built |
| Phase 12 | The exchange rate source |
| Phase 14 | Whether to pursue Account Aggregator, the partner, and the business and compliance requirements |
