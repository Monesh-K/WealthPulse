require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const db = require('./models/database');
const assetsRouter = require('./routes/assets');
const liabilitiesRouter = require('./routes/liabilities');
const goalsRouter = require('./routes/goals');
const transactionsRouter = require('./routes/transactions');
const snapshotsRouter = require('./routes/snapshots');
const essentialsRouter = require('./routes/essentials');
const settingsRouter = require('./routes/settings');
const importRouter = require('./routes/import');
const bankAccountsRouter = require('./routes/bankAccounts');
const authRouter = require('./routes/auth');
const profilesRouter = require('./routes/profiles');
const budgetsRouter = require('./routes/budgets');
const marketService = require('./services/marketService');
const aiService = require('./services/aiService');
const cloudBackup = require('./services/cloudBackup');
const { requireAuth, optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Cloud Backup: auto-save middleware ──────────
// Triggers a debounced backup after any data-mutating API request
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
    // Hook into response finish to trigger save only on success
    const origEnd = res.end;
    res.end = function (...args) {
      origEnd.apply(this, args);
      if (res.statusCode < 400) {
        cloudBackup.scheduleSave();
      }
    };
  }
  next();
});

// ─── Security Middleware ─────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com", "https://s3.tradingview.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://lh3.googleusercontent.com", "https://*.googleusercontent.com", "https://www.googleapis.com"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://www.google.com", "https://s.tradingview.com", "https://www.tradingview-widget.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use('/api/', apiLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many sign-in attempts. Please try again later.' },
});
app.use('/api/auth/', authLimiter);

// Body parsing & cookies
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes (auth is public, data routes use requireAuth)
app.use('/api/auth', authRouter);
app.use('/api/assets', requireAuth, assetsRouter);
app.use('/api/liabilities', requireAuth, liabilitiesRouter);
app.use('/api/goals', requireAuth, goalsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/snapshots', requireAuth, snapshotsRouter);
app.use('/api/essentials', requireAuth, essentialsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/import', requireAuth, importRouter);
app.use('/api/bank-accounts', requireAuth, bankAccountsRouter);
app.use('/api/profiles', requireAuth, profilesRouter);
app.use('/api/budgets', requireAuth, budgetsRouter);

// ─── Market Data endpoints ───────────────────────
app.get('/api/market/mf/:schemeCode', requireAuth, async (req, res) => {
  try {
    const nav = await marketService.fetchMFNav(req.params.schemeCode);
    res.json({ success: true, nav });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/market/stock/:ticker', requireAuth, async (req, res) => {
  try {
    const price = await marketService.fetchStockPrice(req.params.ticker);
    res.json({ success: true, price });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/market/gold', requireAuth, async (req, res) => {
  try {
    const price = await marketService.fetchGoldPrice();
    res.json({ success: true, price });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/market/forex', requireAuth, async (req, res) => {
  try {
    const rate = await marketService.fetchForexRate();
    res.json({ success: true, rate });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/market/refresh', requireAuth, async (req, res) => {
  try {
    const updated = await marketService.refreshAllPrices(db);
    res.json({ success: true, updated });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ─── Last refresh info endpoint ──────────────────
app.get('/api/market/status', requireAuth, (req, res) => {
  try {
    const lastRefresh = db.prepare("SELECT value FROM settings WHERE key = 'last_market_refresh'").get();
    const fxRate = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get();
    const mfCount = db.prepare("SELECT COUNT(*) as count FROM assets WHERE subtype LIKE '%Mutual Fund%'").get();
    const indStockCount = db.prepare("SELECT COUNT(*) as count FROM assets WHERE (subtype = 'Stock' OR subtype = 'ETF') AND currency != 'USD'").get();
    const usStockCount = db.prepare("SELECT COUNT(*) as count FROM assets WHERE category = 'International'").get();
    res.json({
      success: true,
      data: {
        lastRefresh: lastRefresh?.value || null,
        fxRate: fxRate?.value ? Number(fxRate.value) : null,
        totalAssets: assetCount?.count || 0,
        mutualFunds: mfCount?.count || 0,
        indianStocks: indStockCount?.count || 0,
        usStocks: usStockCount?.count || 0,
      }
    });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/market/gold-silver-ratio', requireAuth, async (req, res) => {
  try {
    const result = await marketService.getGoldSilverRatio();
    res.json(result);
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ─── Portfolio vs Index Comparison ───────────────
app.get('/api/market/portfolio-vs-index', requireAuth, async (req, res) => {
  try {
    const snapshots = db.prepare('SELECT date, net_worth FROM snapshots ORDER BY date ASC').all();
    if (snapshots.length < 2) {
      return res.json({ success: false, error: 'Need at least 2 snapshots for comparison' });
    }

    const firstDate = snapshots[0].date;
    const firstNetWorth = snapshots[0].net_worth;

    // Portfolio normalized series: index 100 at start
    const portfolioSeries = snapshots.map(s => ({
      date: s.date,
      value: Math.round((s.net_worth / firstNetWorth) * 10000) / 100,
    }));

    // Fetch historical index data from Yahoo Finance
    const indices = [
      { symbol: '^NSEI', name: 'Nifty 50' },
      { symbol: '^BSESN', name: 'Sensex' },
      { symbol: '^NDX', name: 'NASDAQ 100' },
      { symbol: '^GSPC', name: 'S&P 500' },
    ];

    const fetchIndexHistory = async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=5y`;
        const defaultHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' };
        const r = await fetch(url, { headers: defaultHeaders });
        const data = await r.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];

        // Build date → price map
        const priceMap = {};
        timestamps.forEach((ts, i) => {
          if (closes[i] != null) {
            const d = new Date(ts * 1000).toISOString().split('T')[0].substring(0, 7); // YYYY-MM
            priceMap[d] = closes[i];
          }
        });

        // Find price at or just after firstDate
        const firstYM = firstDate.substring(0, 7);
        const sortedYMs = Object.keys(priceMap).sort();
        const startYM = sortedYMs.find(ym => ym >= firstYM);
        if (!startYM) return null;
        const basePrice = priceMap[startYM];
        if (!basePrice) return null;

        // For each portfolio snapshot date, find closest monthly price
        const series = snapshots.map(s => {
          const ym = s.date.substring(0, 7);
          // Proper YYYY-MM distance calculation
          const monthDist = (a, b) => {
            const [ay, am] = a.split('-').map(Number);
            const [by, bm] = b.split('-').map(Number);
            return Math.abs((ay * 12 + am) - (by * 12 + bm));
          };
          // Find closest month in price map
          const closest = sortedYMs.reduce((best, cur) => {
            if (!best) return cur;
            return monthDist(cur, ym) < monthDist(best, ym) ? cur : best;
          }, null);
          const price = closest ? priceMap[closest] : null;
          return {
            date: s.date,
            value: price ? Math.round((price / basePrice) * 10000) / 100 : null,
          };
        });

        return { name: symbol, series };
      } catch (e) {
        console.warn(`[Market] Index history failed for ${symbol}:`, e.message);
        return null;
      }
    };

    const indexResults = await Promise.all(indices.map(idx => fetchIndexHistory(idx.symbol)));
    const indexSeries = {};
    indices.forEach((idx, i) => {
      if (indexResults[i]) indexSeries[idx.name] = indexResults[i].series;
    });

    res.json({
      success: true,
      data: {
        labels: snapshots.map(s => s.date),
        portfolio: portfolioSeries,
        indices: indexSeries,
        firstDate,
        currentNetWorth: snapshots[snapshots.length - 1].net_worth,
        portfolioReturn: Math.round((snapshots[snapshots.length - 1].net_worth / firstNetWorth - 1) * 10000) / 100,
      }
    });
  } catch (e) {
    console.error('[Market] Portfolio vs index comparison failed:', e.message);
    res.json({ success: false, error: e.message });
  }
});


app.get('/api/news', requireAuth, async (req, res) => {
  try {
    const newsService = require('./services/newsService');
    const news = await newsService.getNews();
    res.json({ success: true, data: news });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/news/article', requireAuth, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL required' });
    const newsService = require('./services/newsService');
    const result = await newsService.fetchArticleContent(url);
    res.json(result);
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// Dashboard summary
app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const liabilities = db.prepare('SELECT * FROM liabilities').all();
    const goals = db.prepare('SELECT * FROM goals').all();
    const snapshots = db.prepare('SELECT * FROM snapshots ORDER BY date ASC').all();

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const income = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= ?').get('income', monthStart);
    const expenses = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= ?').get('expense', monthStart);
    const investmentExpenses = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND category = 'Investment' AND date >= ?").get(monthStart);

    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const getINR = (a, field) => {
      const val = a[field] || 0;
      return a.currency === 'USD' ? val * fxRate : val;
    };

    const totalAssets = assets.reduce((s, a) => s + getINR(a, 'current_value'), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);
    const totalInvested = assets.reduce((s, a) => s + getINR(a, 'invested_value'), 0);
    const totalCurrent = assets.reduce((s, a) => s + getINR(a, 'current_value'), 0);

    // Retirement corpus
    const retirementAssets = assets.filter(a => a.category === 'Retirement');
    const retirementCorpus = retirementAssets.reduce((s, a) => s + getINR(a, 'current_value'), 0);
    const liquidNetWorth = (totalAssets - totalLiabilities) - retirementCorpus;
    const retirementPct = totalAssets > 0 ? (retirementCorpus / totalAssets * 100) : 0;

    // Emergency fund: Cash + Liquid/Arbitrage funds + FDs (excl retirement)
    const isFD = (a) => {
      if ((a.category || '').toLowerCase() === 'retirement') return false;
      const sub = (a.subtype || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      if (sub.includes('epf') || sub.includes('nps') || sub.includes('ppf')) return false;
      return sub.includes('fd') || sub.includes('fixed deposit') || sub.includes('recurring deposit') ||
             sub.includes(' rd') || sub.startsWith('rd') ||
             name.includes('fixed deposit') ||
             (name.includes('fd') && a.interest_rate > 0 && a.tenure_months > 0);
    };
    let emergencyFundValue = 0;
    assets.forEach(a => {
      const cat = a.category || 'Other';
      const ft = (a.fund_type || '').toLowerCase();
      if (cat !== 'Retirement' && (cat === 'Cash' || ft === 'arbitrage' || ft === 'liquid' || isFD(a))) {
        emergencyFundValue += getINR(a, 'current_value');
      }
    });
    const monthlyExp = expenses?.total || 0;
    const emergencyMonths = monthlyExp > 0 ? emergencyFundValue / monthlyExp : 0;

    res.json({
      success: true,
      data: {
        totalAssets, totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        totalInvested, totalCurrent,
        gainLoss: totalCurrent - totalInvested,
        monthlyIncome: income?.total || 0,
        monthlyExpenses: monthlyExp,
        monthlyInvestment: investmentExpenses?.total || 0,
        assetCount: assets.length,
        liabilityCount: liabilities.length,
        goalCount: goals.length,
        snapshotCount: snapshots.length,
        retirementCorpus,
        liquidNetWorth,
        retirementPct,
        emergencyFundValue,
        emergencyMonths,
        topAssets: assets.sort((a, b) => (b.current_value || b.invested_value || 0) - (a.current_value || a.invested_value || 0)).slice(0, 5),
        snapshots: snapshots.slice(-12),
        goals: goals.slice(0, 3),
        allocationByCategory: getAssetAllocation(assets)
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

function getAssetAllocation(assets) {
  const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
  const fxRate = fxRow ? Number(fxRow.value) : 85;
  const cats = {};
  assets.forEach(a => {
    const cat = a.category || 'Other';
    const val = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || a.invested_value || 0);
    cats[cat] = (cats[cat] || 0) + val;
  });
  return cats;
}

// ─── AI Insights endpoints ──────────────────────
app.post('/api/ai/insight', requireAuth, async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ success: false, error: 'Missing insight type' });
    // Inject user age from settings
    const ageRow = db.prepare("SELECT value FROM settings WHERE key = 'age'").get();
    const insightData = { ...(data || {}), userAge: ageRow ? Number(ageRow.value) : null };
    const result = await aiService.getInsight(type, insightData);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/ai/status', requireAuth, (req, res) => {
  res.json({ success: true, enabled: aiService.enabled });
});

// AI Chat endpoint
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    // Gather portfolio context
    const assets = db.prepare('SELECT * FROM assets').all();
    const liabilities = db.prepare('SELECT * FROM liabilities').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const getINR = (a, field) => {
      const val = a[field] || 0;
      return a.currency === 'USD' ? val * fxRate : val;
    };

    const totalAssets = assets.reduce((s, a) => s + getINR(a, 'current_value'), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);
    const totalInvested = assets.reduce((s, a) => s + getINR(a, 'invested_value'), 0);
    const totalCurrent = totalAssets;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const income = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= ?').get('income', monthStart);
    const expenses = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= ?').get('expense', monthStart);

    // Retirement corpus
    const retirementAssets = assets.filter(a => a.category === 'Retirement');
    const retirementCorpus = retirementAssets.reduce((s, a) => s + getINR(a, 'current_value'), 0);

    // User age from settings
    const ageRow = db.prepare("SELECT value FROM settings WHERE key = 'age'").get();

    const portfolioData = {
      netWorth: totalAssets - totalLiabilities,
      totalInvested,
      totalCurrent,
      gainLoss: totalCurrent - totalInvested,
      totalLiabilities,
      assetCount: assets.length,
      allocationByCategory: getAssetAllocation(assets),
      topAssets: assets.sort((a, b) => getINR(b, 'current_value') - getINR(a, 'current_value')).slice(0, 10),
      monthlyIncome: income?.total || 0,
      monthlyExpenses: expenses?.total || 0,
      retirementCorpus,
      liquidNetWorth: totalAssets - totalLiabilities - retirementCorpus,
      userAge: ageRow ? Number(ageRow.value) : null,
    };

    const result = await aiService.chatWithPortfolio(message, portfolioData);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// OAuth2 callback page for Google Sign-In popup
app.get('/auth/google/callback', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Signing in...</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;">
<p>Signing you in... This window will close automatically.</p>
<script>
  // The id_token is in the URL hash fragment — parent window reads it
  // Keep this page open briefly so the parent can poll location.href
  setTimeout(function() { window.close(); }, 5000);
</script>
</body></html>`);
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ─────────────────────────────────────────────────
// SCHEDULED TASKS
// ─────────────────────────────────────────────────

// 1. MF NAV refresh — daily at 9:30 PM IST (NAVs update by ~9 PM)
cron.schedule('30 21 * * *', async () => {
  console.log('[CRON] 🔄 Daily MF NAV refresh...');
  try {
    const updated = await marketService.refreshMFPrices(db);
    console.log(`[CRON] ✅ Updated ${updated} mutual fund NAVs`);
  } catch (e) {
    console.error('[CRON] ❌ MF refresh failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 2. Indian stock prices — every 5 min during NSE market hours (9:15 AM – 3:30 PM IST, Mon–Fri)
cron.schedule('*/5 9-15 * * 1-5', async () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = now.getHours();
  const min = now.getMinutes();
  // Only run between 9:15 and 15:35
  if (hour === 9 && min < 15) return;
  if (hour === 15 && min > 35) return;
  if (hour > 15) return;

  console.log('[CRON] 📈 Live Indian stock price refresh...');
  try {
    const updated = await marketService.refreshIndianStockPrices(db);
    console.log(`[CRON] ✅ Updated ${updated} Indian stocks`);
  } catch (e) {
    console.error('[CRON] ❌ Indian stock refresh failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 3. US stock prices — every 10 min during NYSE/NASDAQ hours (9:30 AM – 4:00 PM ET = 7 PM – 1:30 AM IST)
cron.schedule('*/10 19-23 * * 1-5', async () => {
  console.log('[CRON] 🇺🇸 Live US stock price refresh...');
  try {
    const updated = await marketService.refreshUSStockPrices(db);
    console.log(`[CRON] ✅ Updated ${updated} US stocks`);
  } catch (e) {
    console.error('[CRON] ❌ US stock refresh failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// Also run US stocks at 0:00-1:30 AM IST (continuation of US market hours)
cron.schedule('*/10 0-1 * * 2-6', async () => {
  console.log('[CRON] 🇺🇸 Live US stock price refresh (late night)...');
  try {
    const updated = await marketService.refreshUSStockPrices(db);
    console.log(`[CRON] ✅ Updated ${updated} US stocks`);
  } catch (e) {
    console.error('[CRON] ❌ US stock refresh failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 4. Full refresh — daily at 6:00 PM IST (after Indian market close, catches gold/FD/forex)
cron.schedule('0 18 * * 1-5', async () => {
  console.log('[CRON] 🔄 Full market refresh (EOD)...');
  try {
    const updated = await marketService.refreshAllPrices(db);
    console.log(`[CRON] ✅ Full refresh: ${updated} assets updated`);
  } catch (e) {
    console.error('[CRON] ❌ Full refresh failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 5. Monthly snapshot on 10th of each month at 9 AM IST
cron.schedule('0 9 10 * *', () => {
  console.log('[CRON] 📸 Auto-taking monthly snapshot...');
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const liabilities = db.prepare('SELECT * FROM liabilities').all();

    // Get FX rate for USD → INR conversion
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const getINR = (a) => {
      const val = a.current_value || a.invested_value || 0;
      return a.currency === 'USD' ? val * fxRate : val;
    };

    const totalAssets = assets.reduce((s, a) => s + getINR(a), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);
    const cats = {};
    assets.forEach(a => {
      const cat = a.category || 'Other';
      cats[cat] = (cats[cat] || 0) + getINR(a);
    });
    db.prepare(`INSERT INTO snapshots (date, assets, liabilities, net_worth, allocation) VALUES (?, ?, ?, ?, ?)`)
      .run(new Date().toISOString().split('T')[0], totalAssets, totalLiabilities, totalAssets - totalLiabilities, JSON.stringify(cats));
    console.log('[CRON] ✅ Monthly snapshot saved');
  } catch (e) {
    console.error('[CRON] ❌ Snapshot failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 6. Recurring transactions — daily at midnight IST
cron.schedule('0 0 * * *', () => {
  console.log('[CRON] Generating due recurring transactions...');
  try {
    const { generateRecurringTransactions } = require('./routes/transactions');
    const result = generateRecurringTransactions();
    console.log(`[CRON] ${result.message}`);
  } catch (e) {
    console.error('[CRON] Recurring transaction generation failed:', e.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ─── Startup: restore cloud backup, then start server ──
async function startServer() {
  // Step 1: Restore data from cloud backup (if configured)
  if (cloudBackup.enabled) {
    console.log('\n☁️  Cloud Backup is ENABLED');
    console.log('   • Auto-save: 30s after last data change');
    console.log('   • Periodic save: every 5 minutes');
    console.log('   • Shutdown save: on SIGTERM/SIGINT\n');
    try {
      await cloudBackup.restoreFromCloud();
    } catch (e) {
      console.error('[CloudBackup] Restore error (continuing anyway):', e.message);
    }
  } else {
    console.log('\n☁️  Cloud Backup is DISABLED (set GITHUB_TOKEN + GIST_ID to enable)\n');
  }

  // Step 2: Start HTTP server
  app.listen(PORT, () => {
    console.log(`\n🚀 WealthPulse is running at http://localhost:${PORT}\n`);
    console.log('📅 Scheduled refreshes:');
    console.log('   • MF NAVs: daily at 9:30 PM IST');
    console.log('   • Indian stocks: every 5 min during market hours (9:15 AM – 3:30 PM IST)');
    console.log('   • US stocks: every 10 min during market hours (7 PM – 1:30 AM IST)');
    console.log('   • Full refresh (gold, forex, FD): daily at 6 PM IST');
    console.log('   • Monthly snapshot: 10th of each month at 9 AM IST');
    if (cloudBackup.enabled) {
      console.log('   • Cloud backup: every 5 min + on data changes + on shutdown');
    }
    console.log('');

    // Delayed startup refresh
    setTimeout(async () => {
      console.log('[Startup] Running initial market price refresh...');
      try {
        const updated = await marketService.refreshAllPrices(db);
        console.log(`[Startup] ✅ Refreshed ${updated} assets`);
      } catch (e) {
        console.error('[Startup] ❌ Initial refresh failed:', e.message);
      }
    }, 10000);
  });
}

// ─── Cloud Backup: periodic save every 5 minutes ──
cron.schedule('*/5 * * * *', async () => {
  if (!cloudBackup.enabled) return;
  console.log('[CRON] ☁️  Periodic cloud backup...');
  try {
    await cloudBackup.saveToCloud();
  } catch (e) {
    console.error('[CRON] ❌ Cloud backup failed:', e.message);
  }
});

// ─── Graceful shutdown: save to cloud before exit ──
async function gracefulShutdown(signal) {
  console.log(`\n[Shutdown] ${signal} received — saving to cloud...`);
  try {
    await cloudBackup.forceSave();
    console.log('[Shutdown] ✅ Cloud backup saved');
  } catch (e) {
    console.error('[Shutdown] ❌ Cloud backup failed:', e.message);
  }
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Go!
startServer();
