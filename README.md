# BalanceTrack - Complete Expense & Income Tracker

A comprehensive web application for tracking personal finances, expenses, and income with secure authentication and real-time data management.

##  Project Overview

BalanceTrack is a full-stack web application that allows users to:
- Track income from multiple sources
- Monitor expenses across categories
- Manage bank accounts and credit cards
- Generate monthly financial summaries
- View real-time wealth calculations

## 🏗️ Architecture

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
- **Deployment**: Production-ready on Railway platform

### Database Schema
- **Users**: Secure authentication with security questions
- **Financial Accounts**: Banks, credit cards, cash balance
- **Transactions**: Income and expense tracking with categorization
- **Enhanced Precision**: DECIMAL(20,2) for very large amounts

## 🚀 Features

### Authentication & Security
- ✅ Secure user registration and login
- ✅ Password strength validation
- ✅ Security question-based password reset
- ✅ Session management with secure cookies
- ✅ Rate limiting on authentication endpoints
- ✅ XSS and SQL injection protection
- ✅ **Content Security Policy (CSP) compliance**
- ✅ **Helmet.js security headers**
- ✅ **CSRF protection with SameSite cookies**

### Financial Management
- ✅ Multiple bank account management
- ✅ Credit card tracking with limits
- ✅ Cash balance management
- ✅ Income tracking from various sources
- ✅ Expense categorization and tracking
- ✅ Real-time balance calculations

### Advanced Features
- ✅ Monthly financial summaries
- ✅ Wealth tracking (banks + cash)
- ✅ Net savings calculations
- ✅ Historical data analysis
- ✅ Support for very large amounts (up to 999,999,999,999,999,999.99)
- ✅ Flexible tracking options (income only, expenses only, or both)
- ✅ **Mobile-responsive design with touch-friendly interface**
- ✅ **Real-time data synchronization**
- ✅ **Enhanced activity feed with unified transaction history**
- ✅ **Beautiful gradient UI with smooth animations**
- ✅ **Advanced filtering and search capabilities**

### Data Integrity
- ✅ Automatic balance updates
- ✅ Transaction validation
- ✅ Date-based filtering
- ✅ Concurrent operation safety

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
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

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/forgot-username` - Username recovery
- `POST /api/reset-password` - Password reset

### Financial Account Endpoints
- `GET /api/banks` - Get user's banks
- `POST /api/banks` - Add new bank
- `GET /api/credit-cards` - Get user's credit cards
- `POST /api/credit-cards` - Add new credit card
- `GET /api/cash-balance` - Get cash balance
- `POST /api/cash-balance` - Set cash balance

### Transaction Endpoints
- `GET /api/income` - Get income entries
- `POST /api/income` - Add income entry
- `GET /api/expenses` - Get expense entries
- `POST /api/expenses` - Add expense entry
- `GET /api/monthly-summary` - Get monthly financial summary
- `GET /api/activity` - Get unified activity feed with filtering

## 🧪 Testing

The project includes comprehensive testing with 260+ test cases across 16 test suites:

### Test Coverage
- **Backend API Testing**: Server endpoints and authentication
- **Database Testing**: Schema validation and operations
- **Frontend Testing**: JavaScript modules and integration
- **Security Testing**: Edge cases and vulnerability prevention
- **Integration Testing**: End-to-end workflows
- **Activity Testing**: Comprehensive activity feed validation
- **CSP Compliance**: Content Security Policy adherence

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:backend
npm run test:frontend
npm run test:integration

# Generate coverage report
npm run test:coverage
```

### Test Suites
1. `server.test.js` - Backend API endpoints
2. `auth.test.js` - Authentication functionality
3. `setup-db.test.js` - Database schema validation
4. `frontend-*.test.js` - Frontend module testing
5. `integration.test.js` - End-to-end testing
6. `edge-cases.test.js` - Security and edge case testing
7. `comprehensive-coverage.test.js` - Complete system validation

## 🔧 NPM Scripts

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js",
  "setup-db": "node setup-db.js",
  "migrate-db": "node migrate-db.js",
  "check-schema": "node check-schema.js",
  "reset-db": "node reset-db.js",
  "test": "jest",
  "test:backend": "jest tests/server.test.js tests/auth.test.js",
  "test:frontend": "jest tests/frontend-*.test.js",
  "test:integration": "jest tests/integration.test.js",
  "test:coverage": "jest --coverage",
  "test:watch": "jest --watch",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "deploy:local": "./deploy.sh local",
  "deploy:docker": "./deploy.sh docker",
  "deploy:production": "./deploy.sh production"
}
```

## 🏢 Production Deployment

### Security Checklist
- ✅ Environment variables configured
- ✅ Session secrets generated securely
- ✅ HTTPS enabled (for production)
- ✅ Rate limiting configured
- ✅ Error handling secured
- ✅ Database connections secured

### Environment Configuration
```env
NODE_ENV=production
SESSION_SECRET=<generate-secure-64-byte-hex>
DB_SSL=true
PORT=443
```

## 🌐 Live Production Deployment

### Railway Deployment Status
- ✅ **Live URL**: [https://balance-track.up.railway.app/](https://balance-track.up.railway.app/)
- ✅ **Database**: PostgreSQL on Railway
- ✅ **SSL/HTTPS**: Automatic SSL certificates
- ✅ **Auto-scaling**: Enabled with Railway's infrastructure
- ✅ **Environment**: Production-optimized configuration
- ✅ **Security**: Full CSP compliance, secure headers, rate limiting
- ✅ **Mobile**: Fully responsive across all devices

### Production Features
- 🔒 **Enterprise Security**: Content Security Policy, CSRF protection
- 📱 **Mobile Optimized**: Touch-friendly interface with sliding sidebar
- ⚡ **High Performance**: Optimized queries and connection pooling
- 🚀 **Auto-scaling**: Handles traffic spikes automatically
- 💾 **Data Persistence**: PostgreSQL with automatic backups
- 🔍 **Monitoring**: Error tracking and performance monitoring ready

### Deployment Options
1. **Cloud Platforms**: ✅ Railway (current), Heroku, Vercel
2. **VPS/Server**: Ubuntu/CentOS with nginx reverse proxy
3. **Container**: Docker deployment ready
4. **Database**: PostgreSQL on AWS RDS, Google Cloud SQL, Railway PostgreSQL

## 📈 Performance & Scalability

### Optimizations Implemented
- ✅ Modular frontend architecture (50% reduction in API calls)
- ✅ Efficient database queries with indexing
- ✅ Session-based authentication (minimal overhead)
- ✅ Static file serving optimization
- ✅ Connection pooling for database
- ✅ **CSP-compliant security (no inline JavaScript)**
- ✅ **Mobile-optimized responsive design**
- ✅ **Production deployment on Railway with automatic scaling**

### Scalability Features
- ✅ Horizontal scaling ready
- ✅ Database migration support
- ✅ Environment-based configuration
- ✅ Stateless session management
- ✅ CDN-ready static assets

## 🐛 Debugging & Monitoring

### Debug Features
- ✅ Comprehensive error logging
- ✅ Debug module included (`public/js/debug.js`)
- ✅ Development vs production error handling
- ✅ Database query logging
- ✅ Frontend console debugging

### Monitoring Ready
- Request logging middleware ready
- Error tracking integration points
- Performance monitoring hooks
- Health check endpoints available

## 🤝 Contributing

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

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Documentation
- API documentation in code comments
- Security analysis in `SECURITY-ANALYSIS.md`
- Linting guidelines in `LINTING.md`
- Git workflow in `GIT-PUSH-GUIDE.md`

### Troubleshooting
1. **Database Connection Issues**: Check PostgreSQL service and credentials
2. **Authentication Problems**: Verify session configuration and secrets
3. **Frontend Errors**: Check browser console and network tab
4. **Performance Issues**: Enable debug mode and check logs

---

**BalanceTrack** - Your complete solution for personal financial management! 💰📊
