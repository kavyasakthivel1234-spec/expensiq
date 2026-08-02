<<<<<<< HEAD
# 💰 ExpenseIQ — AI-Powered Personal Expense Tracker

A production-ready full-stack FinTech application that helps users track expenses, manage budgets, and receive personalized AI-driven investment recommendations based on real Indian financial schemes.

---

## 🚀 Live Demo

| Service | URL |
|---|---|
| Frontend | Deploy on Vercel |
| Backend  | Deploy on Render |
| Database | MongoDB Atlas    |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6), Bootstrap 5 |
| Backend  | Node.js, Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth     | JWT + bcrypt.js |
| AI       | Groq API (openai/gpt-oss-20b) |
| Charts   | Chart.js |

---

## ✨ Features

### 🔐 Authentication
- Register / Login with JWT
- bcrypt password hashing
- Protected routes via JWT middleware
- Auto-redirect on token expiry

### 💸 Expense Management
- Full CRUD (Create, Read, Update, Delete)
- Categories: Food, Travel, Shopping, Bills, Health, Entertainment, Education, Others
- Payment methods: Cash, Card, UPI, Net Banking
- Smart search — searches title, category, and notes simultaneously
- Filter by category, date range
- Sort by date or amount
- Pagination

### 💵 Income Management
- Full CRUD for income records
- Categories: Salary, Freelance, Business, Investment, Gift, Others
- Monthly income stats

### 📊 Dashboard Analytics
- Total income, total expense, net balance
- This month's spending
- Expense by category — doughnut chart
- Income vs Expense — 6-month bar chart
- Recent 5 transactions

### 🎯 Budget Management
- Set monthly budget per category
- Real-time spending vs budget tracking
- Progress bars with warning (80%) and exceeded alerts
- Edit budget with salary validation
- Professional delete confirmation modal

### 🤖 AI Financial Advisor (Groq API)
- Personalized spending analysis
- Health score (1–10)
- Overspending detection per category
- **Truly personalized** investment scheme recommendations based on:
  - Monthly income & expenses
  - Financial goal (Emergency Fund, Retirement, Tax Saving, etc.)
  - Risk appetite (Low / Medium / High)
  - Top spending category
  - Saving rate
- Recommended Investment Plan with allocation table
- Monthly Action Plan with category-specific steps
- Real Indian schemes: PPF, NPS, ELSS, SIP, FD, RD, NSC, SGB, Liquid Fund, Emergency Fund

### 👤 User Profile
- View & update profile
- Change password with current password verification

### 🌙 Dark Mode
- Full dark/light theme toggle
- Persists across sessions

---

## 📁 Project Structure

```
ExpenseIQ/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB Atlas connection
│   ├── controllers/
│   │   ├── authController.js      # Register, Login, Profile
│   │   ├── expenseController.js   # Expense CRUD + Smart Search
│   │   ├── incomeController.js    # Income CRUD
│   │   ├── dashboardController.js # Analytics aggregations
│   │   ├── budgetController.js    # Budget management
│   │   └── aiController.js        # Groq AI insights & advisor
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT protect + restrictTo
│   ├── models/
│   │   ├── User.js
│   │   ├── Expense.js
│   │   ├── Income.js
│   │   └── Budget.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── incomeRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── budgetRoutes.js
│   │   └── aiRoutes.js
│   ├── services/
│   │   └── groqService.js         # Groq API client with model fallback
│   ├── utils/
│   │   └── generateToken.js       # JWT token generation
│   ├── server.js
│   └── .env
│
└── frontend/
    ├── index.html          # Login / Register
    ├── dashboard.html      # Analytics dashboard
    ├── expenses.html       # Expense management
    ├── income.html         # Income management
    ├── budget.html         # Budget manager
    ├── ai-insights.html    # AI Financial Advisor
    ├── profile.html        # User profile
    └── assets/
        ├── css/style.css
        └── js/
            ├── utils.js    # Shared helpers, API wrapper, toasts
            ├── auth.js
            ├── dashboard.js
            ├── expenses.js
            ├── income.js
            ├── budget.js
            ├── ai.js
            └── profile.js
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login and get JWT |
| GET  | `/api/auth/me` | Private | Get logged-in user |
| PUT  | `/api/auth/profile` | Private | Update profile / password |

### Expenses
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET    | `/api/expenses` | Private | Get all (search/filter/sort/paginate) |
| POST   | `/api/expenses` | Private | Create expense |
| GET    | `/api/expenses/:id` | Private | Get by ID |
| PUT    | `/api/expenses/:id` | Private | Update |
| DELETE | `/api/expenses/:id` | Private | Delete |

### Income
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET    | `/api/income` | Private | Get all income |
| POST   | `/api/income` | Private | Add income |
| PUT    | `/api/income/:id` | Private | Update |
| DELETE | `/api/income/:id` | Private | Delete |

### Dashboard
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/dashboard/summary` | Private | Total income/expense/balance |
| GET | `/api/dashboard/category-summary` | Private | Spending by category |
| GET | `/api/dashboard/monthly-report` | Private | 6-month trend |
| GET | `/api/dashboard/recent` | Private | Last 5 transactions |

### Budget
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET    | `/api/budget` | Private | Get budgets with spending |
| POST   | `/api/budget` | Private | Set/update budget |
| PUT    | `/api/budget/:id` | Private | Edit budget |
| DELETE | `/api/budget/:id` | Private | Delete budget |

### AI
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/ai/insights` | Private | Spending analysis |
| POST | `/api/ai/advisor` | Private | Personalized investment plan |

---

## ⚙️ Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Groq API key (free at console.groq.com)

### 1. Clone & Install
```bash
cd backend
npm install
```

### 2. Environment Variables
Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/expenseiq
JWT_SECRET=your_long_random_secret
JWT_EXPIRE=7d
GROQ_API_KEY=your_groq_api_key
FRONTEND_URL=*
```

### 3. Start Backend
```bash
npm run dev          # Development (nodemon)
npm start            # Production
```

### 4. Start Frontend
Open `frontend/index.html` with VS Code Live Server.

---

## 🔒 Security

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens expire in 7 days
- `select: false` on password field — never leaked in responses
- CORS configured for frontend origin
- Input validation on all endpoints
- User data isolation — every query scoped to `req.user._id`
- Generic error messages for auth failures (no email enumeration)

---

## 🤖 AI Personalization Logic

The AI advisor produces **different recommendations for every user** based on:

```
High Food Spending + Low Income + Emergency Goal + Low Risk
  → Liquid Fund, Fixed Deposit, Emergency Fund Account

High Entertainment + Good Income + Tax Saving + Medium Risk
  → ELSS, NPS, PPF, Liquid Fund, FD

High Shopping + High Income + Long-term Wealth + High Risk
  → Index Fund SIP, ELSS, Large Cap SIP, Sovereign Gold Bond
```

The Groq prompt explicitly instructs the AI to:
- Never reuse the same scheme list across different profiles
- Tie every recommendation to the user's actual numbers
- Vary by risk level, goal type, top expense category, and saving rate

---

## 📄 Resume Description

> **ExpenseIQ — AI-Powered Personal Expense Tracker**  
> Built a production-ready full-stack FinTech application using Node.js, Express.js, MongoDB Atlas, and vanilla JavaScript. Implemented JWT authentication, complete CRUD for expenses/income/budget, real-time analytics with Chart.js, and an AI-powered financial advisor using Groq API that generates personalized Indian investment scheme recommendations (PPF, NPS, ELSS, SIP) based on each user's spending patterns, financial goals, and risk profile.

---

## 🚢 Deployment

### Backend → Render
1. Push backend to GitHub
2. Create Web Service on Render
3. Set environment variables from `.env`
4. Build command: `npm install`
5. Start command: `npm start`

### Frontend → Vercel
1. Push frontend folder to GitHub
2. Import project on Vercel
3. No build step needed — static HTML

### Database → MongoDB Atlas
- Already configured
- Whitelist `0.0.0.0/0` for all IPs (or Render's IP range for production)

---

## 📝 License

MIT — Free to use for educational and portfolio purposes.
=======
# expensiq
>>>>>>> 4d176c20f7e480136915550011b091a604df9a2e
