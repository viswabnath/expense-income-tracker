# BalanceTrack API Documentation

All endpoints live in `server.js` under `/api`. Request and response bodies are JSON.

## Base URL
```
http://localhost:3000/api
```

## Authentication

Session-cookie based (`sessionId` cookie, HTTP-only, `SameSite=strict`, 2-hour lifetime, `Secure` in production). Every endpoint except register, login, logout, forgot-username, forgot-password and reset-password requires a valid session; otherwise it returns `401 { "error": "Authentication required" }`.

### Register
**POST** `/api/register`

```json
{
  "username": "letters, numbers, underscores; max 50",
  "password": "8-16 chars, upper + lower + digit + one of _ - @ : &",
  "name": "max 100",
  "email": "valid email, max 255",
  "securityQuestion": "string",
  "securityAnswer": "max 200"
}
```
All fields are required. Response: `{ "success": true, "userId": 1 }`. Duplicate username or email returns `400`.

### Login
**POST** `/api/login`

```json
{ "username": "string", "password": "string" }
```
Response: `{ "success": true, "userId": 1, "name": "string", "trackingOption": "income|expenses|both" }`

### Logout
**POST** `/api/logout` → `{ "success": true }`

### Current user
**GET** `/api/user` → the logged-in user's profile row.

### Set tracking option
**POST** `/api/set-tracking-option`

```json
{ "trackingOption": "income | expenses | both" }
```
Response: `{ "success": true }`

### Forgot username
**POST** `/api/forgot-username`

```json
{ "email": "string" }
```
Response: `{ "success": true, "username": "string", "name": "string", "message": "Username found successfully" }`

### Forgot password (step 1)
**POST** `/api/forgot-password`

```json
{ "username": "string", "email": "string" }
```
Response: `{ "success": true, "userId": 1, "username": "string", "name": "string", "securityQuestion": "string" }`

### Reset password (step 2)
**POST** `/api/reset-password`

```json
{ "userId": 1, "securityAnswer": "string", "newPassword": "string" }
```
Response: `{ "success": true, "message": "Password reset successfully" }`

## Banks

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/banks` | – | array of bank rows |
| POST | `/api/banks` | `{ "name", "initialBalance" }` | created bank row |
| PUT | `/api/banks/:id` | `{ "name", "initialBalance" }` | updated bank row |
| DELETE | `/api/banks/:id` | – | `{ "success": true, "message": "Bank deleted successfully" }` |

Bank row: `id, user_id, name, initial_balance, current_balance, created_at`. Names are stored upper-case and are unique per user. A bank with transactions cannot be deleted.

## Credit cards

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/credit-cards` | – | array of card rows |
| POST | `/api/credit-cards` | `{ "name", "creditLimit" }` | created card row |
| PUT | `/api/credit-cards/:id` | `{ "name", "creditLimit" }` | updated card row |
| DELETE | `/api/credit-cards/:id` | – | `{ "success": true, "message": "Credit card deleted successfully" }` |

Card row: `id, user_id, name, credit_limit, used_limit, created_at`.

## Cash balance

**GET** `/api/cash-balance` → `{ id, user_id, balance, initial_balance, updated_at }`, or `{ "balance": 0 }` if never set.

**POST** `/api/cash-balance`

```json
{ "balance": 5000, "initial_balance": 5000 }
```
Creates the row on first call. On update, sending both fields changes the setup values; sending only `balance` adjusts the running balance and keeps `initial_balance`. Returns the cash balance row.

## Income

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/income` | `?month=1-12&year=YYYY` | array of income rows |
| GET | `/api/income/:id` | – | one income row |
| POST | `/api/income` | see below | created income row |
| PUT | `/api/income/:id` | same as POST | `{ "success": true, "message": "Income transaction updated successfully" }` |
| DELETE | `/api/income/:id` | – | `{ "success": true, "message": "Income transaction deleted successfully" }` |

```json
{
  "source": "string",
  "amount": 1000,
  "creditedToType": "bank | cash",
  "creditedToId": 1,
  "date": "YYYY-MM-DD"
}
```
`creditedToId` is the bank id when `creditedToType` is `bank`. Adding, editing, and deleting income updates the linked bank or cash balance.

## Expenses

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/expenses` | `?month=1-12&year=YYYY` | array of expense rows |
| GET | `/api/expenses/:id` | – | one expense row |
| POST | `/api/expenses` | see below | created expense row |
| PUT | `/api/expenses/:id` | same as POST | `{ "success": true, "message": "Expense transaction updated successfully" }` |
| DELETE | `/api/expenses/:id` | – | `{ "success": true, "message": "Expense transaction deleted successfully" }` |

```json
{
  "title": "string",
  "amount": 500,
  "paymentMethod": "cash | bank | credit_card",
  "paymentSourceId": 1,
  "date": "YYYY-MM-DD"
}
```
`paymentSourceId` is the bank or credit card id (omit for cash). Expenses reduce the bank/cash balance or increase the card's `used_limit`.

## Monthly summary

**GET** `/api/monthly-summary?month=1-12&year=YYYY`

```json
{
  "monthlyIncome": 0,
  "totalExpenses": 0,
  "netSavings": 0,
  "totalCurrentWealth": 0,
  "totalInitialBalance": 0,
  "banks": [],
  "creditCards": [],
  "cash": { "balance": 0, "initial_balance": 0 },
  "selectedMonth": 7,
  "selectedYear": 2025,
  "trackingOption": "both",
  "isCurrentMonth": false,
  "isMonthCompleted": true,
  "message": null
}
```
When the month has no transactions, `message` is `"No transactions found for this month"` and the totals are 0.

## Activity log

**GET** `/api/activity`

Query parameters (all optional):
- `page` (default 1), `limit` (default 20)
- `type`: entity type, one of `income`, `expense`, `bank`, `credit_card`, `cash_balance`
- `month` + `year`, or `year` alone, or `from_date` / `to_date` (YYYY-MM-DD)
- `export=true`: returns a CSV file (`activity-export.csv`) instead of JSON, without pagination

Response:
```json
{
  "activities": [
    {
      "activity_type": "bank",
      "description": "Added bank account: HDFC",
      "amount": "1000.00",
      "account_info": "HDFC",
      "action_type": "created | updated | deleted",
      "old_values": {},
      "new_values": {},
      "created_at": "timestamp"
    }
  ],
  "statistics": { "totalTransactions": 0, "totalIncome": 0, "totalExpenses": 0, "netBalance": 0 },
  "currentPage": 1,
  "totalPages": 1,
  "totalItems": 0,
  "limit": 20
}
```

## Errors

Errors return `{ "error": "message" }` with status `400` (validation), `401` (not logged in), `404` (record not found for this user) or `500`.

## Rate limiting

- All requests: 100 per minute per IP.
- Auth endpoints (register, login, forgot-username, forgot-password, reset-password): 5 **failed** attempts per 15 minutes per IP, then `429`. Successful requests don't count. Skipped when `NODE_ENV` is `development` or `test`.

## Security notes

- Passwords and security answers are hashed with bcrypt.
- Queries use parameterized statements.
- Helmet sets the standard security headers plus a Content-Security-Policy: scripts only from `'self'` and `https://unpkg.com` (Lucide, pinned with an SRI hash), no inline scripts or handlers, fonts from Google Fonts. Inline `style` attributes are allowed. `upgrade-insecure-requests` is only sent in production.
- In production, requests the proxy reports as plain HTTP (`X-Forwarded-Proto: http`) are redirected to HTTPS with a 301.
- Monetary columns are `DECIMAL(20,2)`.
