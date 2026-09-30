# BalanceTrack - Complete Expense & Income Tracker

A comprehensive web application for tracking personal finances, expenses, and income with secure authentication and real-time data management.

## Project Overview

BalanceTrack is a full-stack web application that allows users to:
- Track income from multiple sources
- Monitor expenses across categories
- Manage bank accounts and credit cards
- Generate monthly financial summaries
- View real-time wealth calculations

## Architecture

### Frontend
- **Technology**: Vanilla JavaScript with modular architecture
- **Components**: 
  - Authentication Manager (login/register/password reset)
  - Setup Manager (banks, credit cards, cash balance)
  - Transaction Manager (income/expense tracking)
  - Summary Manager (monthly reports)
  - Navigation Manager (UI transitions)
  - Event Handlers (CSP-compliant event management)
- **UI**: Responsive HTML/CSS with mobile-first design
- **Security**: CSP-compliant with no inline JavaScript

### Backend
- **Technology**: Node.js with Express.js
- **Database**: PostgreSQL with advanced schema
- **Security**: bcryptjs encryption, session management, rate limiting, CSP headers
- **API**: RESTful endpoints for all operations
- **Deployment**: Production-ready with Docker support

### Database Schema
- **Users**: Secure authentication with security questions
- **Financial Accounts**: Banks, credit cards, cash balance
- **Transactions**: Income and expense tracking with categorization
- **Enhanced Precision**: DECIMAL(20,2) for very large amounts

## Features

### Authentication & Security
- Secure user registration and login
- Password strength validation
- Security question-based password reset
- Session management with secure cookies
- General rate limiting (100 requests/minute per IP)
- Auth-endpoint rate limiting (5 failed attempts per 15 minutes; off in development/test)
- Parameterized SQL queries
- **CSP-compliant frontend** (no inline scripts or handlers)
- **Helmet.js security headers and Content-Security-Policy**
- HTTP → HTTPS redirect in production
- **CSRF protection with SameSite cookies**

### Financial Management
- Multiple bank account management
- Credit card tracking with limits
- Cash balance management
- Income tracking from various sources
- Expense categorization and tracking
- Real-time balance calculations
- **Professional 2-hour session timeout policy**
- **Dedicated Resource Pages (About, Security, Privacy, Terms)**
- **Structured Ledger Tables with row borders and hover effects**


### Advanced Features
- Monthly financial summaries
- Wealth tracking (banks + cash)
- Net savings calculations
- Historical data analysis
- Support for very large amounts (up to 999,999,999,999,999,999.99)
- Flexible tracking options (income only, expenses only, or both)
- **Mobile-responsive design with touch-friendly interface**
- **Real-time data synchronization**
- **Enhanced activity feed with unified transaction history and change tracking**
- **Beautiful gradient UI with smooth animations**
- **Advanced filtering and search capabilities**
- **Comprehensive activity logging with old/new value comparison**
- **Entity-specific action descriptions and account information display**

### Data Integrity
- Automatic balance updates
- Transaction validation
- Date-based filtering
- Concurrent operation safety

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expense-income-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=expense_tracker
   DB_PASSWORD=your-password
   DB_PORT=5432
   
   # Security
   SESSION_SECRET=your-secure-session-secret
   NODE_ENV=development
   
   # Server Configuration
   PORT=3000
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb expense_tracker
   
   # Run database setup
   npm run setup-db
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## API Documentation

Full request/response reference: [docs/API.md](docs/API.md).

### Authentication Endpoints
- `POST /api/register`, `POST /api/login`, `POST /api/logout`
- `GET /api/user`, `POST /api/set-tracking-option`
- `POST /api/forgot-username`, `POST /api/forgot-password`, `POST /api/reset-password`

### Financial Account Endpoints
- `GET|POST /api/banks`, `PUT|DELETE /api/banks/:id`
- `GET|POST /api/credit-cards`, `PUT|DELETE /api/credit-cards/:id`
- `GET|POST /api/cash-balance`

### Transaction Endpoints
- `GET|POST /api/income`, `GET|PUT|DELETE /api/income/:id`
- `GET|POST /api/expenses`, `GET|PUT|DELETE /api/expenses/:id`
- `GET /api/monthly-summary` - Monthly financial summary
- `GET /api/activity` - Activity feed with filtering, pagination and CSV export

## Testing

Jest runs two projects defined in `package.json`: **backend** (node environment, real database) and **frontend** (jsdom).

> **Warning:** Backend tests run against the database configured in `.env` and **delete all rows** in the app tables (`npm run test:clean` resets it first). Point `.env` at a dedicated test database before running them.

### Test Coverage
- **Backend API Testing**: Server endpoints and authentication
- **Database Testing**: Schema validation and operations
- **Frontend Testing**: JavaScript modules and integration
- **Security Testing**: Edge cases and vulnerability prevention
- **Integration Testing**: End-to-end workflows
- **Activity Testing**: Comprehensive activity feed validation with change tracking
- **CSP Compliance**: Content Security Policy adherence

### Running Tests
```bash
# Run all tests
npm test

# Reset the test database, then run everything
npm run test:clean

# Run one project
npm run test:backend
npm run test:frontend

# Run a single file
npx jest tests/server.test.js --detectOpenHandles --forceExit

# Generate coverage report
npm run test:coverage
```

### Test Suites
- **Backend:** `server`, `api`, `integration`, `edge-cases`, `activity-endpoint`, `setup-db`, `setup-db-coverage`, `comprehensive-server-coverage`, `server-edge-coverage`, `bank-deletion-fix`, `cash-balance-activity`
- **Frontend:** `auth`, `frontend-integration`, `frontend-coverage`, `modular-architecture`, `activity-table-coverage`, `smart-cash-button`, `enhanced-summary-messages`, `csp-compliance`

## NPM Scripts

| Script | What it does |
|---|---|
| `npm start` / `npm run dev` | Start the server (dev uses nodemon) |
| `npm run setup-db` | Create/migrate all tables |
| `npm run reset-test-db` | Delete all rows from the app tables (`--with-user` also seeds `testuser`) |
| `npm test` | Run all tests |
| `npm run test:clean` | Reset the test DB, then run all tests |
| `npm run test:backend` / `test:frontend` | Run one Jest project |
| `npm run test:coverage` / `test:watch` | Coverage report / watch mode |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run deploy:*`, `npm run docker:*` | Use `deploy.sh`, `Dockerfile` and `docker-compose.yml`, which are gitignored and only exist locally |

## Production Deployment

> **Note**: The application is ready for production deployment on any platform that supports Node.js and PostgreSQL.

### Security Checklist
- Environment variables configured
- Session secrets generated securely
- HTTPS enabled (for production)
- Rate limiting configured
- Error handling secured
- Database connections secured

### Environment Configuration
```env
NODE_ENV=production
SESSION_SECRET=<generate-secure-64-byte-hex>
DB_SSL=true
PORT=443
```

## Docker Deployment

### Docker Setup
The application includes Docker configuration for easy deployment:

```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:run

# Stop containers
npm run docker:stop

# View logs
npm run docker:logs
```


### Deployment Options
1. **Cloud Platforms**: Render (config included), Heroku, Vercel, DigitalOcean, AWS
2. **VPS/Server**: Ubuntu/CentOS with nginx reverse proxy
3. **Container**: Docker deployment ready
4. **Database**: PostgreSQL on AWS RDS, Google Cloud SQL, or self-hosted

### Render Deployment
`render.yaml` defines a free-tier web service plus a Render PostgreSQL database (`balancetrack-db`). The `DB_*` variables are wired from that database, `SESSION_SECRET` is generated, and `DB_SSL=true` is set. The Supabase database in the local `.env` is used for development and tests only.

## Performance & Scalability

### Optimizations Implemented
- Modular frontend architecture (50% reduction in API calls)
- Efficient database queries with indexing
- Session-based authentication (minimal overhead)
- Static file serving optimization
- Connection pooling for database
- **CSP-compliant security (no inline JavaScript)**
- **Mobile-optimized responsive design**
- **Production deployment ready with Docker and cloud platform support**

### Scalability Features
- Sessions stored in PostgreSQL (`connect-pg-simple`), so multiple app instances can share them
- Environment-based configuration

## Debugging & Monitoring

- Server errors are logged to the console with `console.error`.
- `public/js/module-validator.js` checks that the frontend modules loaded (used by the tests; not loaded by `index.html`).

## Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit pull request

### Code Standards
- ESLint configuration included
- Modular JavaScript architecture
- Comprehensive test coverage required
- Security-first development approach

## License

`package.json` declares the ISC license. There is no LICENSE file in the repository yet.

## Support

### Documentation
- [docs/API.md](docs/API.md) - endpoint reference
- [docs/STATUS.md](docs/STATUS.md) - current status and known issues
- [CLAUDE.md](CLAUDE.md) - codebase guide for Claude Code

### Troubleshooting
1. **Database Connection Issues**: Check PostgreSQL service and credentials
2. **Authentication Problems**: Verify session configuration and secrets
3. **Frontend Errors**: Check browser console and network tab
4. **Performance Issues**: Enable debug mode and check logs

---

**BalanceTrack** - Your complete solution for personal financial management!
