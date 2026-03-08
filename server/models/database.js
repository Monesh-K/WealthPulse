const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'wealthpulse.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Equity',
    subtype TEXT DEFAULT '',
    invested_value REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    units REAL DEFAULT 0,
    ticker TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    currency TEXT DEFAULT 'INR',
    fx_rate REAL DEFAULT 1,
    interest_rate REAL DEFAULT 0,
    tenure_months INTEGER DEFAULT 0,
    maturity_value REAL DEFAULT 0,
    bank_name TEXT DEFAULT '',
    fund_house TEXT DEFAULT '',
    monthly_contribution REAL DEFAULT 0,
    updated_at TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS liabilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Other',
    outstanding REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    emi REAL DEFAULT 0,
    tenure INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    target_year INTEGER DEFAULT 2030,
    inflation REAL DEFAULT 6,
    linked_asset TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'Other',
    subcategory TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    assets REAL DEFAULT 0,
    liabilities REAL DEFAULT 0,
    net_worth REAL DEFAULT 0,
    allocation TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS essentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    term_insurance REAL DEFAULT 0,
    health_insurance REAL DEFAULT 0,
    emergency_fund REAL DEFAULT 0,
    dependents INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS target_allocation (
    category TEXT PRIMARY KEY,
    percentage REAL DEFAULT 0
  );

  -- Insert defaults if empty
  INSERT OR IGNORE INTO essentials (id) VALUES (1);
  INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'INR');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('name', 'User');
  INSERT OR IGNORE INTO target_allocation (category, percentage) VALUES
    ('Equity', 60), ('Debt', 20), ('Gold', 10), ('Cash', 5), ('International', 5);


  -- Profiles table (family multi-profile support)
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship TEXT DEFAULT 'Self',
    color TEXT DEFAULT '#6366f1',
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Budgets table (monthly budget tracking)
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    monthly_limit REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Asset transactions table (buy/sell/dividend log per asset)
  CREATE TABLE IF NOT EXISTS asset_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'buy',
    units REAL DEFAULT 0,
    price REAL DEFAULT 0,
    amount REAL NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  -- Goal-asset linking join table
  CREATE TABLE IF NOT EXISTS goal_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    UNIQUE(goal_id, asset_id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
  CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
  CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
  CREATE INDEX IF NOT EXISTS idx_asset_transactions_asset_id ON asset_transactions(asset_id);
  CREATE INDEX IF NOT EXISTS idx_goal_assets_goal_id ON goal_assets(goal_id);
  CREATE INDEX IF NOT EXISTS idx_goal_assets_asset_id ON goal_assets(asset_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);

  -- Bank accounts table
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank_name TEXT DEFAULT '',
    account_type TEXT DEFAULT 'Savings',
    balance REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (date('now'))
  );

  -- Users table (Google OAuth)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT NOT NULL,
    name TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Seed Retirement allocation
db.prepare("INSERT OR IGNORE INTO target_allocation (category, percentage) VALUES (?, ?)").run('Retirement', 0);

// ── Migration: Add subcategory column to existing transactions table ──
try {
  db.prepare("SELECT subcategory FROM transactions LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE transactions ADD COLUMN subcategory TEXT DEFAULT ''");
  console.log('[DB] Migrated: added subcategory column to transactions');
}

// ── Migration: Create index on (category, subcategory) if missing ──
try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_category_sub ON transactions(category, subcategory)");
} catch { /* already exists */ }

// ── Migration: Add asset_class and fund_type columns to assets table ──
try {
  db.prepare("SELECT asset_class FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN asset_class TEXT DEFAULT ''");
  console.log('[DB] Migrated: added asset_class column to assets');
}
try {
  db.prepare("SELECT fund_type FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN fund_type TEXT DEFAULT ''");
  console.log('[DB] Migrated: added fund_type column to assets');
}

// ── Migration: Add bank_account field to transactions ──
try {
  db.prepare("SELECT bank_account FROM transactions LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE transactions ADD COLUMN bank_account TEXT DEFAULT ''");
  console.log('[DB] Migrated: added bank_account column to transactions');
}

// ── Migration: Add sip_amount to assets ──
try {
  db.prepare("SELECT sip_amount FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN sip_amount REAL DEFAULT 0");
  console.log('[DB] Migrated: added sip_amount column to assets');
}

// ── Migration: Add sip_date to assets ──
try {
  db.prepare("SELECT sip_date FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN sip_date INTEGER DEFAULT 0");
  console.log('[DB] Migrated: added sip_date column to assets');
}

// ── Migration: Add purchase_date to assets ──
try {
  db.prepare("SELECT purchase_date FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN purchase_date TEXT DEFAULT ''");
  console.log('[DB] Migrated: added purchase_date column to assets');
}

// ── Migration: Add super_topup column to essentials ──
try {
  db.prepare("SELECT super_topup FROM essentials LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE essentials ADD COLUMN super_topup REAL DEFAULT 0");
  console.log('[DB] Migrated: added super_topup column to essentials');
}

// ── Migration: Add critical_illness column to essentials ──
try {
  db.prepare("SELECT critical_illness FROM essentials LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE essentials ADD COLUMN critical_illness REAL DEFAULT 0");
  console.log('[DB] Migrated: added critical_illness column to essentials');
}

// ── Migration: Add account_number to bank_accounts ──
try {
  db.prepare("SELECT account_number FROM bank_accounts LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE bank_accounts ADD COLUMN account_number TEXT DEFAULT ''");
  console.log('[DB] Migrated: added account_number column to bank_accounts');
}

// ── Migration: Add retirement_subtype to assets ──
try {
  db.prepare("SELECT retirement_subtype FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN retirement_subtype TEXT DEFAULT ''");
  console.log('[DB] Migrated: added retirement_subtype column to assets');
}

// ── Migration: Add nps_equity_pct to assets ──
try {
  db.prepare("SELECT nps_equity_pct FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN nps_equity_pct REAL DEFAULT 75");
  console.log('[DB] Migrated: added nps_equity_pct column to assets');
}

// ── Migration: Add nps_debt_pct to assets ──
try {
  db.prepare("SELECT nps_debt_pct FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN nps_debt_pct REAL DEFAULT 25");
  console.log('[DB] Migrated: added nps_debt_pct column to assets');
}

// ── Migration: Add previous_value to assets (for daily change tracking) ──
try {
  db.prepare("SELECT previous_value FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN previous_value REAL DEFAULT 0");
  console.log('[DB] Migrated: added previous_value column to assets');
}

// ── Migration: Add profile_id to assets ──
try {
  db.prepare("SELECT profile_id FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN profile_id INTEGER DEFAULT NULL");
  console.log('[DB] Migrated: added profile_id column to assets');
}

// ── Migration: Add profile_id to liabilities ──
try {
  db.prepare("SELECT profile_id FROM liabilities LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE liabilities ADD COLUMN profile_id INTEGER DEFAULT NULL");
  console.log('[DB] Migrated: added profile_id column to liabilities');
}

// ── Migration: Add profile_id to goals ──
try {
  db.prepare("SELECT profile_id FROM goals LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE goals ADD COLUMN profile_id INTEGER DEFAULT NULL");
  console.log('[DB] Migrated: added profile_id column to goals');
}

// ── Migration: Add recurring transaction columns to transactions ──
try {
  db.prepare("SELECT is_recurring FROM transactions LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE transactions ADD COLUMN is_recurring INTEGER DEFAULT 0");
  console.log('[DB] Migrated: added is_recurring column to transactions');
}
try {
  db.prepare("SELECT frequency FROM transactions LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE transactions ADD COLUMN frequency TEXT DEFAULT NULL");
  console.log('[DB] Migrated: added frequency column to transactions');
}
try {
  db.prepare("SELECT next_due_date FROM transactions LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE transactions ADD COLUMN next_due_date TEXT DEFAULT NULL");
  console.log('[DB] Migrated: added next_due_date column to transactions');
}

// ── Insert default "Self" profile if profiles table is empty ──
(function seedDefaultProfile() {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM profiles").get();
  if (count.cnt === 0) {
    db.prepare("INSERT INTO profiles (name, relationship, color, is_default) VALUES (?, ?, ?, ?)").run('Self', 'Self', '#6366f1', 1);
    console.log('[DB] Inserted default "Self" profile');
  }
})();

// ── Auto-classify existing assets that have no asset_class ──
(function classifyExistingAssets() {
  const unclassified = db.prepare("SELECT * FROM assets WHERE asset_class = '' OR asset_class IS NULL").all();
  if (!unclassified.length) return;
  const update = db.prepare("UPDATE assets SET asset_class = ?, fund_type = ? WHERE id = ?");
  const txn = db.transaction(() => {
    for (const a of unclassified) {
      const sub = (a.subtype || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      let assetClass = '';
      let fundType = '';

      if (sub.includes('mutual fund') || sub.includes('mf')) {
        assetClass = 'Mutual Fund';
        // Determine fund_type from subtype
        const subLower = sub;
        if (subLower.includes('flexi cap') || subLower.includes('flexicap') || subLower.includes('large') || subLower.includes('mid cap') || subLower.includes('midcap') || subLower.includes('small cap') || subLower.includes('smallcap') || subLower.includes('momentum') || subLower.includes('multi cap') || subLower.includes('multicap') || subLower.includes('focused') || subLower.includes('elss') || subLower.includes('value') || subLower.includes('contra') || subLower.includes('dividend yield') || subLower.includes('index') || subLower.includes('sectoral') || subLower.includes('thematic')) {
          fundType = 'Equity';
        } else if (subLower.includes('liquid') || subLower.includes('money market') || subLower.includes('overnight') || subLower.includes('ultra short')) {
          fundType = 'Liquid';
        } else if (subLower.includes('arbitrage')) {
          fundType = 'Arbitrage';
        } else if (subLower.includes('debt') || subLower.includes('gilt') || subLower.includes('bond') || subLower.includes('credit risk') || subLower.includes('dynamic bond') || subLower.includes('corporate bond') || subLower.includes('banking') || subLower.includes('short duration') || subLower.includes('medium duration') || subLower.includes('long duration') || subLower.includes('conservative hybrid') || subLower.includes('regular savings')) {
          fundType = 'Debt';
        } else if (subLower.includes('hybrid') || subLower.includes('balanced') || subLower.includes('multi asset') || subLower.includes('aggressive hybrid')) {
          fundType = 'Hybrid';
        } else if (subLower.includes('gold') || subLower.includes('silver') || subLower.includes('commodit')) {
          fundType = 'Commodity';
        } else {
          // Default for MF: classify by category
          const catLower = (a.category || '').toLowerCase();
          if (catLower === 'equity') fundType = 'Equity';
          else if (catLower === 'debt') fundType = 'Debt';
          else if (catLower === 'gold') fundType = 'Commodity';
          else fundType = 'Equity';
        }
      } else if (sub === 'stock' || name.includes('limited') || name.includes('ltd')) {
        assetClass = 'Stock';
      } else if (sub === 'etf' || sub.includes('etf') || name.includes('etf')) {
        assetClass = 'ETF';
      } else if (sub.includes('us stock') || (a.category === 'International' && a.currency === 'USD')) {
        assetClass = 'Stock';
      } else if (sub.includes('epf') || sub.includes('nps') || sub.includes('ppf')) {
        assetClass = 'Retirement';
      } else if (sub.includes('fd') || sub.includes('fixed deposit') || sub.includes('rd') || sub.includes('recurring')) {
        assetClass = 'Fixed Income';
      } else if (a.category === 'Gold' || sub.includes('gold') || sub.includes('silver') || sub.includes('commodit')) {
        assetClass = 'Commodity';
      } else if (a.category === 'Cash') {
        assetClass = 'Cash';
      } else if (a.category === 'Real Estate') {
        assetClass = 'Real Estate';
      } else if (a.category === 'Crypto') {
        assetClass = 'Crypto';
      } else {
        assetClass = 'Other';
      }

      update.run(assetClass, fundType, a.id);
    }
  });
  txn();
  console.log(`[DB] Auto-classified ${unclassified.length} assets`);
})();

// ── Migration: Fix EPF/NPS/PPF assets — set category and asset_class to 'Retirement' ──
(function fixRetirementAssets() {
  const retirementSubtypes = ['epf', 'nps', 'ppf'];
  const assets = db.prepare("SELECT id, subtype FROM assets WHERE category != 'Retirement'").all();
  const update = db.prepare("UPDATE assets SET category = 'Retirement', asset_class = 'Retirement' WHERE id = ?");
  const txn = db.transaction(() => {
    let count = 0;
    for (const a of assets) {
      const sub = (a.subtype || '').toLowerCase();
      if (retirementSubtypes.some(r => sub.includes(r))) {
        update.run(a.id);
        count++;
      }
    }
    if (count > 0) console.log(`[DB] Fixed ${count} EPF/NPS/PPF assets → category Retirement`);
  });
  txn();
})();

// ── Migration: Add gold loan fields to liabilities ──
try {
  db.prepare("SELECT gold_weight FROM liabilities LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE liabilities ADD COLUMN gold_weight REAL DEFAULT 0");
  console.log('[DB] Migrated: added gold_weight column to liabilities');
}
try {
  db.prepare("SELECT gold_purity FROM liabilities LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE liabilities ADD COLUMN gold_purity TEXT DEFAULT '22K'");
  console.log('[DB] Migrated: added gold_purity column to liabilities');
}
try {
  db.prepare("SELECT pledged_value FROM liabilities LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE liabilities ADD COLUMN pledged_value REAL DEFAULT 0");
  console.log('[DB] Migrated: added pledged_value column to liabilities');
}

// ── Migration: Add insurance detail columns to essentials ──
const insuranceCols = [
  ['term_policy_id', 'TEXT', "''"],
  ['term_provider', 'TEXT', "''"],
  ['term_premium', 'REAL', '0'],
  ['term_expiry', 'TEXT', "''"],
  ['term_claim_number', 'TEXT', "''"],
  ['term_nominee', 'TEXT', "''"],
  ['term_notes', 'TEXT', "''"],
  ['health_policy_id', 'TEXT', "''"],
  ['health_provider', 'TEXT', "''"],
  ['health_premium', 'REAL', '0'],
  ['health_expiry', 'TEXT', "''"],
  ['health_claim_number', 'TEXT', "''"],
  ['health_members', 'TEXT', "''"],
  ['health_notes', 'TEXT', "''"],
];
insuranceCols.forEach(([col, type, def]) => {
  try { db.prepare(`SELECT ${col} FROM essentials LIMIT 1`).get(); }
  catch {
    db.exec(`ALTER TABLE essentials ADD COLUMN ${col} ${type} DEFAULT ${def}`);
    console.log(`[DB] Migrated: added ${col} column to essentials`);
  }
});

// ── Migration: Add is_emergency_fund flag to assets ──
try {
  db.prepare("SELECT is_emergency_fund FROM assets LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE assets ADD COLUMN is_emergency_fund INTEGER DEFAULT 0");
  console.log('[DB] Migrated: added is_emergency_fund column to assets');
}

module.exports = db;
