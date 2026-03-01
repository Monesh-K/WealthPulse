const express = require('express');
const router = express.Router();
const db = require('../models/database');

// ─── Helper: get INR value for an asset ───
function inrValue(asset, field = 'current_value') {
  const val = asset[field] || 0;
  if (asset.currency === 'USD') {
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const rate = fxRow ? Number(fxRow.value) : 85;
    return val * rate;
  }
  return val;
}

// ─── Helper: enrich asset with INR values ───
function enrichAsset(a) {
  if (a.currency === 'USD') {
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const rate = fxRow ? Number(fxRow.value) : 85;
    a.fx_rate = rate;
    a.invested_value_inr = a.invested_value * rate;
    a.current_value_inr = a.current_value * rate;
  } else {
    a.invested_value_inr = a.invested_value;
    a.current_value_inr = a.current_value;
  }
  // Auto-calculate FD current value based on compound interest
  if (isFD(a) && a.invested_value > 0 && a.interest_rate > 0 && a.purchase_date) {
    const fdCalc = calcFDValue(a);
    a.current_value = fdCalc.currentValue;
    a.current_value_inr = a.currency === 'USD' ? a.current_value * (a.fx_rate || 1) : a.current_value;
    a.maturity_value = fdCalc.maturityValue;
    a.fd_days_elapsed = fdCalc.daysElapsed;
    a.fd_days_total = (a.tenure_months || 0) * 30;
    a.fd_maturity_date = fdCalc.maturityDate;
    a.fd_interest_earned = fdCalc.currentValue - a.invested_value;
  }
  // Round units to 2 decimals for display
  a.units_display = a.units ? Number(a.units.toFixed(2)) : 0;
  return a;
}

// ─── Helper: check if asset is a Fixed Deposit ───
function isFD(a) {
  const sub = (a.subtype || '').toLowerCase();
  const cls = (a.asset_class || '').toLowerCase();
  const name = (a.name || '').toLowerCase();
  return sub.includes('fd') || sub.includes('fixed deposit') || cls === 'fixed income' ||
         name.includes('fixed deposit') || (name.includes('fd') && (a.interest_rate > 0 && a.tenure_months > 0));
}

// ─── Helper: calculate FD current and maturity value (quarterly compounding) ───
function calcFDValue(a) {
  const principal = a.invested_value || 0;
  const annualRate = a.interest_rate / 100;
  const tenureMonths = a.tenure_months || 12;
  const purchaseDate = new Date(a.purchase_date);
  const now = new Date();
  const maturityDate = new Date(purchaseDate);
  maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

  // Quarterly compounding (n=4)
  const n = 4;
  const totalYears = tenureMonths / 12;
  const maturityValue = principal * Math.pow(1 + annualRate / n, n * totalYears);

  // Current value: compound interest for elapsed time
  const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.max(1, Math.floor((maturityDate - purchaseDate) / (1000 * 60 * 60 * 24)));
  const elapsedYears = Math.min(daysElapsed / 365.25, totalYears);

  let currentValue;
  if (now >= maturityDate) {
    currentValue = maturityValue; // FD matured
  } else {
    currentValue = principal * Math.pow(1 + annualRate / n, n * elapsedYears);
  }

  return {
    currentValue: Math.round(currentValue * 100) / 100,
    maturityValue: Math.round(maturityValue * 100) / 100,
    daysElapsed,
    totalDays,
    maturityDate: maturityDate.toISOString().split('T')[0],
  };
}

// Get all assets (with pagination)
router.get('/', (req, res) => {
  try {
    const { category, subtype, asset_class, fund_type, search, page, pageSize } = req.query;
    let sql = 'SELECT * FROM assets';
    let countSql = 'SELECT COUNT(*) as total FROM assets';
    const params = [];
    const conditions = [];

    if (category) { conditions.push('category = ?'); params.push(category); }
    if (subtype) { conditions.push('subtype = ?'); params.push(subtype); }
    if (asset_class) { conditions.push('asset_class = ?'); params.push(asset_class); }
    if (fund_type) { conditions.push('fund_type = ?'); params.push(fund_type); }
    if (search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(ticker) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    if (conditions.length) {
      const where = ' WHERE ' + conditions.join(' AND ');
      sql += where;
      countSql += where;
    }
    sql += ' ORDER BY current_value DESC';

    // Count
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow?.total || 0;

    // Pagination
    const pg = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(1000, Math.max(1, parseInt(pageSize) || 50));
    const offset = (pg - 1) * ps;
    sql += ` LIMIT ${ps} OFFSET ${offset}`;

    const assets = db.prepare(sql).all(...params).map(enrichAsset);

    res.json({ success: true, data: assets, total, page: pg, pageSize: ps, totalPages: Math.ceil(total / ps) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get all asset names (for dropdowns like goals)
router.get('/names', (req, res) => {
  try {
    const assets = db.prepare('SELECT id, name, category, asset_class, current_value, currency FROM assets ORDER BY name ASC').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const data = assets.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      asset_class: a.asset_class,
      current_value_inr: a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || 0),
    }));
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get asset allocation summary
router.get('/allocation', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const byCategory = {};
    const byAssetClass = {};
    const byFundType = {};
    let totalValue = 0;
    let totalInvested = 0;
    let emergencyFundValue = 0;

    assets.forEach(a => {
      // Enrich with FD auto-calculation
      if (isFD(a) && a.invested_value > 0 && a.interest_rate > 0 && a.purchase_date) {
        const fdCalc = calcFDValue(a);
        a.current_value = fdCalc.currentValue;
      }
      const val = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || a.invested_value || 0);
      const inv = a.currency === 'USD' ? (a.invested_value || 0) * fxRate : (a.invested_value || 0);
      const cat = a.category || 'Other';
      const cls = a.asset_class || 'Other';
      const ft = a.fund_type || '';

      byCategory[cat] = (byCategory[cat] || 0) + val;
      byAssetClass[cls] = (byAssetClass[cls] || 0) + val;
      if (ft) byFundType[ft] = (byFundType[ft] || 0) + val;
      totalValue += val;
      totalInvested += inv;

      // Emergency fund: Cash + Arbitrage funds + Liquid funds + Fixed Deposits
      const ftLower = (a.fund_type || '').toLowerCase();
      if (cat === 'Cash' || ftLower === 'arbitrage' || ftLower === 'liquid' || isFD(a)) {
        emergencyFundValue += val;
      }
    });

    res.json({
      success: true,
      data: {
        byCategory,
        byAssetClass,
        byFundType,
        totalValue,
        totalInvested,
        emergencyFundValue,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Merge duplicate assets (combine by name)
router.post('/merge-duplicates', (req, res) => {
  try {
    const dupes = db.prepare(`
      SELECT LOWER(TRIM(name)) as lname, COUNT(*) as cnt FROM assets
      GROUP BY LOWER(TRIM(name)) HAVING cnt > 1
    `).all();

    if (!dupes.length) return res.json({ success: true, merged: 0, message: 'No duplicates found' });

    let merged = 0;
    const txn = db.transaction(() => {
      for (const { lname } of dupes) {
        const rows = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = ? ORDER BY created_at ASC').all(lname);
        if (rows.length < 2) continue;

        const primary = rows[0];
        let totalInvested = primary.invested_value || 0;
        let totalCurrent = primary.current_value || 0;
        let totalUnits = primary.units || 0;
        const allNotes = [primary.notes || ''];

        for (let i = 1; i < rows.length; i++) {
          totalInvested += rows[i].invested_value || 0;
          totalCurrent += rows[i].current_value || 0;
          totalUnits += rows[i].units || 0;
          if (rows[i].notes) allNotes.push(rows[i].notes);
          db.prepare('DELETE FROM assets WHERE id = ?').run(rows[i].id);
        }

        db.prepare(`UPDATE assets SET invested_value = ?, current_value = ?, units = ?,
          notes = ?, updated_at = date('now') WHERE id = ?`)
          .run(totalInvested, totalCurrent, totalUnits, allNotes.join(' | '), primary.id);

        merged += rows.length - 1;
      }
    });
    txn();

    res.json({ success: true, merged, message: `Merged ${merged} duplicate assets` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get distinct asset classes and fund types (for filter dropdowns)
router.get('/filters', (req, res) => {
  try {
    const assetClasses = db.prepare("SELECT DISTINCT asset_class FROM assets WHERE asset_class != '' AND asset_class IS NOT NULL ORDER BY asset_class").all().map(r => r.asset_class);
    const fundTypes = db.prepare("SELECT DISTINCT fund_type FROM assets WHERE fund_type != '' AND fund_type IS NOT NULL ORDER BY fund_type").all().map(r => r.fund_type);
    const categories = db.prepare("SELECT DISTINCT category FROM assets ORDER BY category").all().map(r => r.category);
    res.json({ success: true, data: { assetClasses, fundTypes, categories } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get single asset
router.get('/:id', (req, res) => {
  try {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true, data: enrichAsset(asset) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Create asset
router.post('/', (req, res) => {
  try {
    const { id, name, category, subtype, invested_value, current_value, units, ticker, notes,
            currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution,
            asset_class, fund_type, purchase_date } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Name is required' });
    if (name.length > 300) return res.status(400).json({ success: false, error: 'Name too long (max 300 chars)' });
    const numInvested = parseFloat(invested_value) || 0;
    const numCurrent = parseFloat(current_value) || numInvested;
    if (numInvested < 0 || numCurrent < 0) return res.status(400).json({ success: false, error: 'Values cannot be negative' });
    const validCurrencies = ['INR', 'USD'];
    const safeCurrency = validCurrencies.includes(currency) ? currency : 'INR';
    const assetId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes,
      currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution, asset_class, fund_type, purchase_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(assetId, name, category || 'Equity', subtype || '', invested_value || 0,
        current_value || invested_value || 0, units || 0, ticker || '', notes || '',
        currency || 'INR', interest_rate || 0, tenure_months || 0, bank_name || '',
        fund_house || '', monthly_contribution || 0, asset_class || '', fund_type || '', purchase_date || '');
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    res.json({ success: true, data: enrichAsset(asset) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Update asset
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Asset not found' });
    const { name, category, subtype, invested_value, current_value, units, ticker, notes,
            currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution,
            asset_class, fund_type, purchase_date } = req.body;
    db.prepare(`UPDATE assets SET name=?, category=?, subtype=?, invested_value=?, current_value=?,
      units=?, ticker=?, notes=?, currency=?, interest_rate=?, tenure_months=?, bank_name=?,
      fund_house=?, monthly_contribution=?, asset_class=?, fund_type=?, purchase_date=?, updated_at=date('now') WHERE id=?`)
      .run(name || existing.name, category || existing.category, subtype ?? existing.subtype,
        invested_value ?? existing.invested_value, current_value ?? existing.current_value,
        units ?? existing.units, ticker ?? existing.ticker, notes ?? existing.notes,
        currency || existing.currency, interest_rate ?? existing.interest_rate,
        tenure_months ?? existing.tenure_months, bank_name ?? existing.bank_name,
        fund_house ?? existing.fund_house, monthly_contribution ?? existing.monthly_contribution,
        asset_class ?? existing.asset_class, fund_type ?? existing.fund_type,
        purchase_date ?? existing.purchase_date,
        req.params.id);
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: enrichAsset(asset) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Delete asset
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Bulk upsert (for imports)
router.post('/bulk', (req, res) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets)) return res.status(400).json({ success: false, error: 'Expected array of assets' });

    const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const findByName = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
    const update = db.prepare(`UPDATE assets SET invested_value = invested_value + ?, current_value = current_value + ?,
      units = units + ?, updated_at = date('now') WHERE id = ?`);

    let imported = 0, consolidated = 0;
    const txn = db.transaction(() => {
      for (const a of assets) {
        if (!a.name) continue;
        const existing = findByName.get(a.name);
        if (existing) {
          update.run(a.invested_value || 0, a.current_value || a.invested_value || 0, a.units || 0, existing.id);
          consolidated++;
        } else {
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          insert.run(id, a.name.trim(), a.category || 'Equity', a.subtype || '',
            a.invested_value || 0, a.current_value || a.invested_value || 0,
            a.units || 0, a.ticker || '', a.notes || '');
          imported++;
        }
      }
    });
    txn();
    res.json({ success: true, imported, consolidated });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
