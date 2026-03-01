# 💰 WealthPulse — Personal Portfolio Tracker

A full-stack personal finance and portfolio tracking web application. Track investments, liabilities, goals, income/expenses, net worth, and get real-time market data — all from a single dashboard.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-lightgrey) ![SQLite](https://img.shields.io/badge/SQLite-WAL-blue)

## ✨ Features

- **Investment Tracking** — Mutual funds, stocks (Indian & US), EPF, NPS, gold, FDs, bonds
- **Auto Market Data** — Real-time prices for stocks, MF NAV, gold, USD/INR forex
- **Liabilities** — Track home loans, car loans, credit cards & EMIs
- **Goal Planning** — Inflation-adjusted targets with linked asset tracking
- **Income & Expenses** — Categorized cash flow management with monthly summaries
- **Net Worth** — Monthly snapshots with trend charts
- **Asset Allocation** — Doughnut charts comparing current vs target allocation
- **CSV/Excel Import** — Bulk import assets and transactions
- **Dark Mode** — Toggle between light and dark themes
- **Responsive** — Works on desktop, tablet, and mobile
- **Auto Refresh** — Daily market price updates via cron (6 PM IST on weekdays)
- **Backup & Restore** — Export/import all data as JSON

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite (via better-sqlite3, WAL mode) |
| **Frontend** | Vanilla JS (SPA architecture), Chart.js |
| **Market APIs** | MFAPI.in, Yahoo Finance, ExchangeRate API, Metals.dev |
| **Automation** | node-cron for scheduled tasks |
| **File Import** | multer + xlsx for CSV/Excel parsing |

## 📂 Project Structure

```
wealthpulse/
├── server/
│   ├── index.js              # Express app, routes, cron jobs
│   ├── models/
│   │   └── database.js       # SQLite schema & connection
│   ├── routes/
│   │   ├── assets.js          # CRUD + bulk import for assets
│   │   ├── liabilities.js     # CRUD for liabilities
│   │   ├── goals.js           # CRUD for goals (with auto-linking)
│   │   ├── transactions.js    # CRUD + summary/categories for income & expenses
│   │   ├── snapshots.js       # Net worth snapshot management
│   │   ├── essentials.js      # Insurance & emergency fund tracking
│   │   ├── settings.js        # Settings, target allocation, backup/restore
│   │   └── import.js          # CSV/Excel file upload & processing
│   └── services/
│       └── marketService.js   # Market data fetching & auto-refresh
├── public/
│   ├── index.html             # SPA shell
│   ├── css/
│   │   └── style.css          # Full CSS with dark mode & responsive design
│   └── js/
│       ├── app.js             # Router & initialization
│       ├── services/
│       │   ├── api.js         # Centralized HTTP client
│       │   ├── utils.js       # Formatting, toast, modal utilities
│       │   └── charts.js      # Chart.js wrapper
│       └── pages/
│           ├── dashboard.js   # Main dashboard with KPIs & charts
│           ├── assets.js      # Investment management
│           ├── liabilities.js # Liability tracking
│           ├── goals.js       # Goal planning & gap analysis
│           ├── transactions.js# Income & expense manager
│           ├── snapshots.js   # Net worth history
│           ├── essentials.js  # Financial health score
│           └── settings.js    # Configuration & backup
├── data/                       # SQLite database (auto-created)
├── package.json
├── .env
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd wealthpulse

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

### Development Mode

```bash
npm run dev    # Auto-restarts on file changes (Node 18+ --watch flag)
```

### Environment Variables

Create a `.env` file in the root:

```env
PORT=3000
DB_PATH=./data/wealthpulse.db
```

## 📊 API Reference

All endpoints return `{ success: boolean, data?: any, error?: string }`.

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Full dashboard summary |

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all (filter: ?category=Equity) |
| POST | `/api/assets` | Create new asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| POST | `/api/assets/bulk` | Bulk upsert (consolidates duplicates) |

### Liabilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/liabilities` | List all |
| POST | `/api/liabilities` | Create |
| PUT | `/api/liabilities/:id` | Update |
| DELETE | `/api/liabilities/:id` | Delete |

### Goals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List all |
| POST | `/api/goals` | Create (auto-links to assets) |
| PUT | `/api/goals/:id` | Update |
| DELETE | `/api/goals/:id` | Delete |

### Transactions (Income & Expenses)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List (filter: ?type=income&month=1&year=2026) |
| GET | `/api/transactions/summary` | Monthly summary |
| GET | `/api/transactions/categories` | Category breakdown |
| POST | `/api/transactions` | Create |
| POST | `/api/transactions/bulk` | Bulk import |
| DELETE | `/api/transactions/:id` | Delete |

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market/mf/:code` | Fetch MF NAV |
| GET | `/api/market/stock/:ticker` | Fetch stock price |
| GET | `/api/market/gold` | Gold price (INR/gram) |
| GET | `/api/market/forex` | USD to INR rate |
| POST | `/api/market/refresh` | Auto-refresh all asset prices |

### Settings & Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get settings & target allocation |
| PUT | `/api/settings` | Update settings |
| GET | `/api/settings/export` | Export all data as JSON |
| POST | `/api/settings/import` | Restore from backup |
| POST | `/api/import/assets` | Upload CSV/Excel for assets |
| POST | `/api/import/transactions` | Upload CSV/Excel for transactions |

## 💡 Asset Ticker Format

- **Indian Stocks**: `RELIANCE.NS`, `TCS.NS`, `INFY.NS`
- **Mutual Funds**: `MF:119551` (AMFI scheme code)
- **US Stocks**: `AAPL`, `MSFT` (set currency to USD)
- **Gold Physical**: Set subtype to "Gold Physical", units = grams

## 🔄 Automated Tasks

- **Daily 6 PM IST** (Mon-Fri): Auto-refresh all asset prices
- **Monthly 1st, 9 AM IST**: Auto-take net worth snapshot

## 📱 Screenshots

The app features:
- Modern dashboard with KPI cards and charts
- Full CRUD for all entities
- CSV/Excel import with duplicate handling
- Dark mode toggle
- Responsive design for mobile

## 📄 License

MIT © Monesh
