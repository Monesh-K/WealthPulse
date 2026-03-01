/**
 * WealthPulse — Cloud Backup Service
 * Auto-saves/restores SQLite data to a private GitHub Gist (free, unlimited).
 *
 * Required env vars:
 *   GITHUB_TOKEN   — GitHub Personal Access Token (with 'gist' scope)
 *   GIST_ID        — ID of the Gist to use (created once, reused forever)
 */
const db = require('../models/database');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GIST_ID = process.env.GIST_ID || '';
const GIST_FILENAME = 'wealthpulse-backup.json';

const enabled = !!(GITHUB_TOKEN && GIST_ID);

// Debounce timer for auto-save (don't save on every single request)
let saveTimer = null;
const SAVE_DELAY = 30_000; // 30 seconds after last change

/**
 * Export all tables as a JSON object
 */
function exportAllData() {
  const safeAll = (sql) => { try { return db.prepare(sql).all(); } catch { return []; } };
  const safeGet = (sql) => { try { return db.prepare(sql).get(); } catch { return null; } };

  return {
    assets: safeAll('SELECT * FROM assets'),
    liabilities: safeAll('SELECT * FROM liabilities'),
    goals: safeAll('SELECT * FROM goals'),
    transactions: safeAll('SELECT * FROM transactions'),
    snapshots: safeAll('SELECT * FROM snapshots'),
    essentials: safeGet('SELECT * FROM essentials WHERE id = 1'),
    settings: safeAll('SELECT * FROM settings'),
    targetAllocation: safeAll('SELECT * FROM target_allocation'),
    bankAccounts: safeAll('SELECT * FROM bank_accounts'),
    users: safeAll('SELECT * FROM users'),
    exportedAt: new Date().toISOString()
  };
}

/**
 * Import all data from a JSON backup (same format as exportAllData)
 */
function importAllData(data) {
  if (!data) return;

  const txn = db.transaction(() => {
    if (data.assets?.length) {
      db.prepare('DELETE FROM assets').run();
      const stmt = db.prepare(`INSERT INTO assets (id,name,category,subtype,invested_value,current_value,units,ticker,notes,currency,fx_rate,interest_rate,tenure_months,maturity_value,bank_name,fund_house,monthly_contribution,asset_class,fund_type,sip_amount,sip_date,purchase_date,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      data.assets.forEach(a => {
        try {
          stmt.run(a.id, a.name, a.category, a.subtype, a.invested_value, a.current_value, a.units, a.ticker, a.notes, a.currency || 'INR', a.fx_rate || 1, a.interest_rate || 0, a.tenure_months || 0, a.maturity_value || 0, a.bank_name || '', a.fund_house || '', a.monthly_contribution || 0, a.asset_class || '', a.fund_type || '', a.sip_amount || 0, a.sip_date || 0, a.purchase_date || '', a.updated_at, a.created_at);
        } catch (e) { console.warn('[CloudBackup] Skip asset:', e.message); }
      });
    }
    if (data.liabilities?.length) {
      db.prepare('DELETE FROM liabilities').run();
      const stmt = db.prepare('INSERT INTO liabilities (id,name,type,outstanding,rate,emi,tenure,notes) VALUES (?,?,?,?,?,?,?,?)');
      data.liabilities.forEach(l => { try { stmt.run(l.id, l.name, l.type, l.outstanding, l.rate, l.emi, l.tenure, l.notes); } catch {} });
    }
    if (data.goals?.length) {
      db.prepare('DELETE FROM goals').run();
      const stmt = db.prepare('INSERT INTO goals (id,name,target_amount,current_value,target_year,inflation,linked_asset,notes) VALUES (?,?,?,?,?,?,?,?)');
      data.goals.forEach(g => { try { stmt.run(g.id, g.name, g.target_amount, g.current_value, g.target_year, g.inflation, g.linked_asset, g.notes); } catch {} });
    }
    if (data.transactions?.length) {
      db.prepare('DELETE FROM transactions').run();
      const stmt = db.prepare('INSERT INTO transactions (id,type,amount,description,category,subcategory,date,bank_account) VALUES (?,?,?,?,?,?,?,?)');
      data.transactions.forEach(t => { try { stmt.run(t.id, t.type, t.amount, t.description, t.category, t.subcategory || '', t.date, t.bank_account || ''); } catch {} });
    }
    if (data.snapshots?.length) {
      db.prepare('DELETE FROM snapshots').run();
      const stmt = db.prepare('INSERT INTO snapshots (date,assets,liabilities,net_worth,allocation) VALUES (?,?,?,?,?)');
      data.snapshots.forEach(s => { try { stmt.run(s.date, s.assets, s.liabilities, s.net_worth, s.allocation); } catch {} });
    }
    if (data.essentials) {
      db.prepare('DELETE FROM essentials').run();
      const e = data.essentials;
      try {
        db.prepare('INSERT INTO essentials (id, term_insurance, health_insurance, emergency_fund, dependents, super_topup, critical_illness, updated_at) VALUES (1,?,?,?,?,?,?,?)')
          .run(e.term_insurance || 0, e.health_insurance || 0, e.emergency_fund || 0, e.dependents || 0, e.super_topup || 0, e.critical_illness || 0, e.updated_at || new Date().toISOString());
      } catch {}
    }
    if (data.settings?.length) {
      db.prepare('DELETE FROM settings').run();
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      data.settings.forEach(s => { try { stmt.run(s.key, s.value); } catch {} });
    }
    if (data.targetAllocation?.length) {
      db.prepare('DELETE FROM target_allocation').run();
      const stmt = db.prepare('INSERT OR REPLACE INTO target_allocation (category, percentage) VALUES (?, ?)');
      data.targetAllocation.forEach(t => { try { stmt.run(t.category, t.percentage); } catch {} });
    }
    if (data.bankAccounts?.length) {
      db.prepare('DELETE FROM bank_accounts').run();
      const stmt = db.prepare('INSERT INTO bank_accounts (id,name,bank_name,account_type,balance,notes,account_number,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
      data.bankAccounts.forEach(b => { try { stmt.run(b.id, b.name, b.bank_name || '', b.account_type || 'Savings', b.balance || 0, b.notes || '', b.account_number || '', b.updated_at, b.created_at); } catch {} });
    }
    if (data.users?.length) {
      db.prepare('DELETE FROM users').run();
      const stmt = db.prepare('INSERT INTO users (id,google_id,email,name,picture,created_at,last_login) VALUES (?,?,?,?,?,?,?)');
      data.users.forEach(u => { try { stmt.run(u.id, u.google_id, u.email, u.name || '', u.picture || '', u.created_at, u.last_login); } catch {} });
    }
  });
  txn();
}

/**
 * Download backup from GitHub Gist and restore into local SQLite
 */
async function restoreFromCloud() {
  if (!enabled) {
    console.log('[CloudBackup] ⏭️  Skipped (GITHUB_TOKEN or GIST_ID not set)');
    return false;
  }

  try {
    console.log('[CloudBackup] ⬇️  Downloading backup from GitHub Gist...');
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      console.warn(`[CloudBackup] ⚠️  Gist fetch failed: ${res.status} ${res.statusText}`);
      return false;
    }

    const gist = await res.json();
    const file = gist.files?.[GIST_FILENAME];
    if (!file || !file.content) {
      console.log('[CloudBackup] 📭 Gist exists but no backup file found — starting fresh');
      return false;
    }

    // If content is truncated (>1MB), fetch raw URL
    let content = file.content;
    if (file.truncated && file.raw_url) {
      const rawRes = await fetch(file.raw_url, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      });
      content = await rawRes.text();
    }

    const data = JSON.parse(content);
    console.log(`[CloudBackup] 📦 Backup found (exported: ${data.exportedAt || 'unknown'})`);

    // Check if local DB already has data
    const localAssets = db.prepare('SELECT COUNT(*) as c FROM assets').get().c;
    if (localAssets > 0) {
      console.log(`[CloudBackup] ℹ️  Local DB has ${localAssets} assets — skipping restore (already populated)`);
      return true;
    }

    importAllData(data);
    const assetCount = db.prepare('SELECT COUNT(*) as c FROM assets').get().c;
    const txnCount = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;
    console.log(`[CloudBackup] ✅ Restored: ${assetCount} assets, ${txnCount} transactions`);
    return true;
  } catch (e) {
    console.error('[CloudBackup] ❌ Restore failed:', e.message);
    return false;
  }
}

/**
 * Upload current SQLite data to GitHub Gist
 */
async function saveToCloud() {
  if (!enabled) return false;

  try {
    const data = exportAllData();
    const content = JSON.stringify(data);

    console.log(`[CloudBackup] ⬆️  Saving backup to GitHub Gist (${(content.length / 1024).toFixed(1)} KB)...`);

    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: { content },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[CloudBackup] ⚠️  Save failed: ${res.status} — ${errText.slice(0, 200)}`);
      return false;
    }

    console.log(`[CloudBackup] ✅ Saved at ${new Date().toISOString()}`);
    return true;
  } catch (e) {
    console.error('[CloudBackup] ❌ Save failed:', e.message);
    return false;
  }
}

/**
 * Schedule a debounced save (call this after any data mutation)
 */
function scheduleSave() {
  if (!enabled) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToCloud().catch(e => console.error('[CloudBackup] Save error:', e.message));
  }, SAVE_DELAY);
}

/**
 * Force immediate save (for shutdown hooks)
 */
async function forceSave() {
  if (!enabled) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await saveToCloud();
}

module.exports = {
  enabled,
  restoreFromCloud,
  saveToCloud,
  scheduleSave,
  forceSave,
  exportAllData,
  importAllData,
};
